//! Хост party-сессии: WS-сервер на tokio. Биндит порт (с фоллбэком), проводит
//! рукопожатие, держит **состав партии** (`Room`) и **снимки листов** игроков,
//! ретранслируя их по правилам видимости. Топология «звезда»: хост = хаб и
//! источник истины (см. docs/PLAN_PARTY_LOCAL.md).
//!
//! LP1: членство + presence (`party-state`). LP2: снимки листов (`member-snapshot`
//! от игрока → хост → `party-snapshot` получателям по видимости `party/gm/hidden`),
//! с догоном для поздно подключившихся. Сетевой слой не зависит от Tauri: события
//! идут в абстрактный `PartyEvents`.

use std::collections::{BTreeMap, HashMap};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

use futures_util::{SinkExt, StreamExt};
use serde_json::{json, Value};
use tauri::async_runtime::JoinHandle;
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::mpsc;
use tokio::sync::Mutex as AsyncMutex;
use tokio_tungstenite::tungstenite::Message;

use super::protocol::{Handshake, Hello, PROTOCOL_VERSION};
use super::PartyEvents;

/// Карта подключённых клиентов: id → канал исходящих кадров этому клиенту.
type Clients = Arc<AsyncMutex<HashMap<u64, mpsc::UnboundedSender<Message>>>>;

struct Member {
    display_name: String,
    online: bool,
}

/// Последний снимок листа участника, который хост хранит для догона поздних
/// клиентов. `visibility`: `party` | `gm` (hidden не хранится — снимок снимается).
struct StoredSnapshot {
    character_id: String,
    character_name: String,
    visibility: String,
    data: Value,
}

/// Состав партии + снимки листов. Источник истины о presence и о том, чей лист
/// кому виден. ГМ (хост) — отдельно, игроки — по id подключения.
struct Room {
    party_name: String,
    gm_name: String,
    members: BTreeMap<u64, Member>,
    snapshots: HashMap<String, StoredSnapshot>,
}

impl Room {
    /// JSON-снимок состава = сообщение `party-state` (хост→все) и payload
    /// события `party://state`. ГМ всегда первым с фиксированным id `"gm"`.
    fn state(&self) -> Value {
        let mut members = vec![json!({
            "id": "gm", "displayName": self.gm_name, "role": "gm", "online": true
        })];
        for (id, m) in &self.members {
            members.push(json!({
                "id": id.to_string(), "displayName": m.display_name,
                "role": "player", "online": m.online
            }));
        }
        json!({ "type": "party-state", "partyName": self.party_name, "gmId": "gm", "members": members })
    }
}

/// Запрос на публикацию снимка от ГМ-локально (хост сам делится листом).
pub struct SnapshotReq {
    pub character_id: String,
    pub character_name: String,
    pub visibility: String,
    pub data: Value,
}

/// Дескриптор активного хоста, который держит `PartyState`.
pub struct HostHandle {
    pub port: u16,
    /// Фронт → все клиенты (broadcast прикладных сообщений, LP3). Текст в JSON-форме.
    pub broadcast_tx: mpsc::UnboundedSender<String>,
    /// ГМ делится своим листом локально (без WS).
    pub snapshot_tx: mpsc::UnboundedSender<SnapshotReq>,
    /// Долгоживущие задачи; обрываются при выходе из партии.
    pub tasks: Vec<JoinHandle<()>>,
}

pub async fn start<E: PartyEvents>(
    events: E,
    port_pref: Option<u16>,
    secret: String,
    gm_name: String,
    party_name: String,
) -> Result<HostHandle, String> {
    let listener = bind_with_fallback(port_pref.unwrap_or(super::DEFAULT_PORT)).await?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();

    let clients: Clients = Arc::new(AsyncMutex::new(HashMap::new()));
    let room = Arc::new(AsyncMutex::new(Room {
        party_name: if party_name.trim().is_empty() { gm_name.clone() } else { party_name },
        gm_name,
        members: BTreeMap::new(),
        snapshots: HashMap::new(),
    }));
    let next_id = Arc::new(AtomicU64::new(1));
    let (broadcast_tx, mut broadcast_rx) = mpsc::unbounded_channel::<String>();
    let (snapshot_tx, mut snapshot_rx) = mpsc::unbounded_channel::<SnapshotReq>();

    // Начальный состав (только ГМ) — сразу в UI хоста.
    let initial = room.lock().await.state();
    events.emit("party://state", initial);

    // Broadcast прикладных сообщений (LP3) → всем клиентам.
    let clients_b = clients.clone();
    let broadcast_task = tauri::async_runtime::spawn(async move {
        while let Some(text) = broadcast_rx.recv().await {
            let map = clients_b.lock().await;
            for tx in map.values() {
                let _ = tx.send(Message::text(text.clone()));
            }
        }
    });

    // ГМ делится своим листом (from = "gm").
    let events_s = events.clone();
    let clients_s = clients.clone();
    let room_s = room.clone();
    let snapshot_task = tauri::async_runtime::spawn(async move {
        while let Some(req) = snapshot_rx.recv().await {
            ingest_snapshot(
                &events_s, &clients_s, &room_s, "gm".to_string(),
                req.character_id, req.character_name, req.visibility, req.data,
            )
            .await;
        }
    });

    // Accept-цикл: на каждое подключение — отдельная задача рукопожатия/чтения.
    let accept_task = tauri::async_runtime::spawn(async move {
        loop {
            match listener.accept().await {
                Ok((stream, _addr)) => {
                    let events = events.clone();
                    let secret = secret.clone();
                    let clients = clients.clone();
                    let room = room.clone();
                    let id = next_id.fetch_add(1, Ordering::Relaxed);
                    tauri::async_runtime::spawn(async move {
                        if let Err(e) = handle_client(&events, id, stream, &secret, &clients, &room).await {
                            log::info!("party client {id} ended: {e}");
                        }
                        // Отключение: offline + чистим его снимок + оповещаем — но
                        // только если клиент успел войти в состав.
                        let was_member = {
                            let mut r = room.lock().await;
                            r.snapshots.remove(&id.to_string());
                            match r.members.get_mut(&id) {
                                Some(m) => {
                                    m.online = false;
                                    true
                                }
                                None => false,
                            }
                        };
                        clients.lock().await.remove(&id);
                        if was_member {
                            // снять чужой лист у всех, кто его видел
                            events.emit("party://snapshot", json!({ "from": id.to_string(), "data": Value::Null }));
                            broadcast_snapshot_cleared(&clients, id.to_string()).await;
                            events.emit("party://peer", json!({ "event": "leave", "id": id.to_string() }));
                            broadcast_state(&events, &clients, &room).await;
                        }
                    });
                }
                Err(e) => {
                    events.emit("party://error", json!({ "message": format!("accept failed: {e}") }));
                    break;
                }
            }
        }
    });

    Ok(HostHandle {
        port,
        broadcast_tx,
        snapshot_tx,
        tasks: vec![broadcast_task, snapshot_task, accept_task],
    })
}

/// Рассылает текущий состав всем клиентам и эмитит его локально (UI хоста).
async fn broadcast_state<E: PartyEvents>(events: &E, clients: &Clients, room: &AsyncMutex<Room>) {
    let state = room.lock().await.state();
    events.emit("party://state", state.clone());
    let text = serde_json::to_string(&state).unwrap_or_default();
    let map = clients.lock().await;
    for tx in map.values() {
        let _ = tx.send(Message::text(text.clone()));
    }
}

/// Сообщить всем клиентам, что снимок участника снят (отключился/спрятал).
async fn broadcast_snapshot_cleared(clients: &Clients, from: String) {
    let frame = json!({ "type": "party-snapshot", "from": from, "data": Value::Null });
    let text = serde_json::to_string(&frame).unwrap_or_default();
    let map = clients.lock().await;
    for tx in map.values() {
        let _ = tx.send(Message::text(text.clone()));
    }
}

/// Принять снимок листа от участника `from_id` и ретранслировать по видимости:
/// `party` — всем (кроме автора) + ГМ; `gm` — только ГМ (локальный эмит);
/// `hidden` — никому (снимок снимается у всех, кто его видел).
async fn ingest_snapshot<E: PartyEvents>(
    events: &E,
    clients: &Clients,
    room: &AsyncMutex<Room>,
    from_id: String,
    character_id: String,
    character_name: String,
    visibility: String,
    data: Value,
) {
    let hidden = visibility == "hidden";
    {
        let mut r = room.lock().await;
        if hidden {
            r.snapshots.remove(&from_id);
        } else {
            r.snapshots.insert(
                from_id.clone(),
                StoredSnapshot {
                    character_id: character_id.clone(),
                    character_name: character_name.clone(),
                    visibility: visibility.clone(),
                    data: data.clone(),
                },
            );
        }
    }

    // ГМ (локально) видит party и gm; при hidden — снятие (data: null).
    let local_data = if hidden { Value::Null } else { data.clone() };
    events.emit(
        "party://snapshot",
        json!({ "from": from_id, "characterId": character_id, "characterName": character_name, "data": local_data }),
    );

    // Клиентам: при `party` — полные данные; при `gm`/`hidden` — СНЯТИЕ
    // (`data: null`). Снятие при `gm` обязательно: иначе у клиента остался бы
    // прежний party-снимок этого участника (баг «переключил Все → Только ГМ, а
    // другой инстанс всё ещё видит лист»). Шлём всем, кроме автора.
    let client_data = if visibility == "party" { data } else { Value::Null };
    let frame = json!({
        "type": "party-snapshot", "from": from_id, "characterId": character_id,
        "characterName": character_name, "data": client_data
    });
    let text = serde_json::to_string(&frame).unwrap_or_default();
    let sender = from_id.parse::<u64>().ok();
    let map = clients.lock().await;
    for (cid, tx) in map.iter() {
        if Some(*cid) == sender {
            continue; // не эхо-им автору его же лист
        }
        let _ = tx.send(Message::text(text.clone()));
    }
}

async fn handle_client<E: PartyEvents>(
    events: &E,
    id: u64,
    stream: TcpStream,
    secret: &str,
    clients: &Clients,
    room: &AsyncMutex<Room>,
) -> Result<(), String> {
    let ws = tokio_tungstenite::accept_async(stream)
        .await
        .map_err(|e| format!("ws accept: {e}"))?;
    let (mut write, mut read) = ws.split();

    // Первый кадр обязан быть hello.
    let first = read
        .next()
        .await
        .ok_or_else(|| "connection closed before hello".to_string())?
        .map_err(|e| e.to_string())?;
    let text = match first {
        Message::Text(t) => t.as_str().to_string(),
        _ => return Err("expected text hello frame".into()),
    };
    let hello: Hello = serde_json::from_str(&text).map_err(|e| format!("bad hello: {e}"))?;

    // Отбиваем несовместимую версию протокола и неверный код партии.
    if hello.v != PROTOCOL_VERSION {
        let _ = write.send(reject_frame("version-mismatch")).await;
        return Err(format!("version mismatch: client v{} != v{PROTOCOL_VERSION}", hello.v));
    }
    if hello.code != secret {
        let _ = write.send(reject_frame("bad-code")).await;
        return Err("bad party code".into());
    }

    let welcome = serde_json::to_string(&Handshake::Welcome {
        v: PROTOCOL_VERSION,
        self_id: id.to_string(),
    })
    .map_err(|e| e.to_string())?;
    write
        .send(Message::text(welcome))
        .await
        .map_err(|e| e.to_string())?;

    // Регистрируем канал исходящих кадров и поднимаем writer-задачу.
    let (tx, mut rx) = mpsc::unbounded_channel::<Message>();
    clients.lock().await.insert(id, tx.clone());

    let writer = tauri::async_runtime::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if write.send(msg).await.is_err() {
                break;
            }
        }
    });

    // Догон поздно подключившегося: уже опубликованные party-снимки → ему.
    {
        let r = room.lock().await;
        for (from, snap) in r.snapshots.iter() {
            if snap.visibility == "party" {
                let frame = json!({
                    "type": "party-snapshot", "from": from, "characterId": snap.character_id,
                    "characterName": snap.character_name, "data": snap.data
                });
                let _ = tx.send(Message::text(serde_json::to_string(&frame).unwrap_or_default()));
            }
        }
    }

    // В состав. Реконнект: сносим «призрак» — прежнего ОФФЛАЙН участника с тем же
    // именем, чтобы он не висел дублем в списке (его снимок уже снят при отключении).
    // Полная стабильная identity (clientId, переживающий рестарт) — отложена в LP4.
    {
        let mut r = room.lock().await;
        let ghosts: Vec<u64> = r
            .members
            .iter()
            .filter(|(_, m)| !m.online && m.display_name == hello.display_name)
            .map(|(gid, _)| *gid)
            .collect();
        for gid in ghosts {
            r.members.remove(&gid);
            r.snapshots.remove(&gid.to_string());
        }
        r.members.insert(id, Member { display_name: hello.display_name.clone(), online: true });
    }
    events.emit(
        "party://peer",
        json!({ "event": "join", "id": id.to_string(), "displayName": hello.display_name }),
    );
    broadcast_state(events, clients, room).await;

    // Чтение кадров клиента: member-snapshot → ретрансляция; остальное → message.
    while let Some(frame) = read.next().await {
        match frame {
            Ok(Message::Text(t)) => {
                let raw = t.as_str().to_string();
                match serde_json::from_str::<Value>(&raw) {
                    Ok(val) if val.get("type").and_then(|v| v.as_str()) == Some("member-snapshot") => {
                        ingest_snapshot(
                            events,
                            clients,
                            room,
                            id.to_string(),
                            val.get("characterId").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                            val.get("characterName").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                            val.get("visibility").and_then(|v| v.as_str()).unwrap_or("hidden").to_string(),
                            val.get("data").cloned().unwrap_or(Value::Null),
                        )
                        .await;
                    }
                    Ok(val) => {
                        events.emit("party://message", json!({ "from": id.to_string(), "data": val }));
                    }
                    Err(_) => {
                        events.emit("party://message", json!({ "from": id.to_string(), "data": raw }));
                    }
                }
            }
            Ok(Message::Close(_)) | Err(_) => break,
            _ => {}
        }
    }

    writer.abort();
    Ok(())
}

fn reject_frame(reason: &str) -> Message {
    // unwrap безопасен: фиксированная структура без непечатаемых полей.
    Message::text(serde_json::to_string(&Handshake::reject(reason)).unwrap())
}

/// Биндит 0.0.0.0 на предпочтительном порту; если занят — пробуем ближайшие.
/// Фактический порт всё равно показывается в UI хоста (см. план, «Параметры»).
async fn bind_with_fallback(start: u16) -> Result<TcpListener, String> {
    let mut last_err = String::new();
    for p in start..=start.saturating_add(20) {
        match TcpListener::bind(("0.0.0.0", p)).await {
            Ok(listener) => return Ok(listener),
            Err(e) => last_err = e.to_string(),
        }
    }
    Err(format!("could not bind any port in {start}..={}: {last_err}", start.saturating_add(20)))
}
