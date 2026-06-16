//! Party-сеть десктопа: P2P-сессии по LAN/VPN без своего сервера
//! (см. docs/PLAN_PARTY_LOCAL.md). Вся сеть живёт на Rust, потому что вебвью в
//! secure-context блокирует `ws://` как mixed-content. Фронт общается через
//! команды Tauri (`party_*`) и события (`party://…`).
//!
//! LP0 — транспорт-фундамент: хост слушает порт, клиент подключается по
//! `IP:порт`, оба проходят рукопожатие с кодом партии и проверкой версии.

mod client;
mod host;
mod protocol;

use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, State};

/// Фиксированный редкий порт по умолчанию (план, «Параметры»). Если занят —
/// хост авто-фоллбэком берёт ближайший свободный, фактический порт уходит во UI.
pub const DEFAULT_PORT: u16 = 47331;

/// Сток событий партии. Абстрагирует `AppHandle::emit`, чтобы сетевой слой
/// (host/client) не зависел от Tauri напрямую и проверялся интеграционными
/// тестами на настоящих сокетах (см. `mod tests`).
pub trait PartyEvents: Clone + Send + Sync + 'static {
    fn emit(&self, event: &str, payload: serde_json::Value);
}

impl PartyEvents for AppHandle {
    fn emit(&self, event: &str, payload: serde_json::Value) {
        // Полная квалификация — иначе рекурсивный вызов этого же метода.
        let _ = tauri::Emitter::emit(self, event, payload);
    }
}

/// Активная сессия: ровно одна на приложение (хост ИЛИ клиент).
enum Active {
    Host(host::HostHandle),
    Client(client::ClientHandle),
}

#[derive(Default)]
pub struct PartyState {
    inner: Mutex<Option<Active>>,
}

/// Что хост возвращает фронту: фактический порт + локальные IPv4, из которых UI
/// собирает шарящийся «код партии» (`ip:port|secret`, кодируется в TS).
#[derive(Serialize)]
pub struct HostInfo {
    port: u16,
    ips: Vec<String>,
}

/// Локальные не-loopback IPv4 — кандидаты адреса хоста (реальная LAN или
/// виртуальная через VPN). Какой именно сообщить игрокам, решает пользователь.
fn local_ipv4s() -> Vec<String> {
    if_addrs::get_if_addrs()
        .map(|addrs| {
            addrs
                .into_iter()
                .filter(|i| !i.is_loopback())
                .filter_map(|i| match i.ip() {
                    std::net::IpAddr::V4(v4) => Some(v4.to_string()),
                    std::net::IpAddr::V6(_) => None,
                })
                .collect()
        })
        .unwrap_or_default()
}

#[tauri::command]
pub async fn party_host_start(
    app: AppHandle,
    state: State<'_, PartyState>,
    port: Option<u16>,
    code: String,
    display_name: String,
    party_name: String,
) -> Result<HostInfo, String> {
    stop_active(&state);
    let handle = host::start(app, port, code, display_name, party_name).await?;
    let info = HostInfo { port: handle.port, ips: local_ipv4s() };
    *state.inner.lock().unwrap() = Some(Active::Host(handle));
    Ok(info)
}

#[tauri::command]
pub async fn party_join(
    app: AppHandle,
    state: State<'_, PartyState>,
    host: String,
    port: u16,
    code: String,
    display_name: String,
) -> Result<(), String> {
    stop_active(&state);
    let handle = client::start(app, host, port, code, display_name).await?;
    *state.inner.lock().unwrap() = Some(Active::Client(handle));
    Ok(())
}

#[tauri::command]
pub fn party_share(
    state: State<'_, PartyState>,
    character_id: String,
    character_name: String,
    visibility: String,
    data: serde_json::Value,
) -> Result<(), String> {
    match state.inner.lock().unwrap().as_ref() {
        // ГМ-локально: кладём снимок в очередь хоста (ретрансляция по видимости).
        Some(Active::Host(h)) => h
            .snapshot_tx
            .send(host::SnapshotReq { character_id, character_name, visibility, data })
            .map_err(|_| "host channel closed".to_string()),
        // Игрок: шлём member-snapshot хосту, дальше он ретранслирует.
        Some(Active::Client(c)) => {
            let msg = serde_json::json!({
                "type": "member-snapshot", "characterId": character_id,
                "characterName": character_name, "visibility": visibility, "data": data
            });
            c.out_tx.send(msg.to_string()).map_err(|_| "client channel closed".to_string())
        }
        None => Err("no active party".to_string()),
    }
}

#[tauri::command]
pub fn party_send(state: State<'_, PartyState>, msg: String) -> Result<(), String> {
    match state.inner.lock().unwrap().as_ref() {
        Some(Active::Host(h)) => h.broadcast_tx.send(msg).map_err(|_| "host channel closed".to_string()),
        Some(Active::Client(c)) => c.out_tx.send(msg).map_err(|_| "client channel closed".to_string()),
        None => Err("no active party".to_string()),
    }
}

#[tauri::command]
pub fn party_leave(app: AppHandle, state: State<'_, PartyState>) -> Result<(), String> {
    stop_active(&state);
    // Резолвится в PartyEvents::emit (единственный `emit` в scope).
    app.emit("party://status", serde_json::json!({ "state": "closed" }));
    Ok(())
}

/// Обрывает задачи текущей сессии и очищает состояние (идемпотентно).
fn stop_active(state: &State<'_, PartyState>) {
    if let Some(active) = state.inner.lock().unwrap().take() {
        let tasks = match active {
            Active::Host(h) => h.tasks,
            Active::Client(c) => c.tasks,
        };
        for task in tasks {
            task.abort();
        }
    }
}

#[cfg(test)]
mod tests {
    //! Интеграционные тесты транспорта LP0 на НАСТОЯЩИХ loopback-сокетах.
    //! Гоняем всё на `tauri::async_runtime` (через `block_on`), чтобы listener,
    //! спавненые задачи и клиент жили на одном реакторе. Запуск: `cargo test`
    //! (по одному потоку: `--test-threads=1`, т.к. делят GLOBAL_RUNTIME).

    use super::{client, host, PartyEvents};
    use futures_util::{SinkExt, StreamExt};
    use std::sync::{Arc, Mutex};
    use std::time::Duration;
    use tokio_tungstenite::tungstenite::Message;

    /// Записывающий сток событий вместо `AppHandle`.
    #[derive(Clone, Default)]
    struct TestEvents {
        log: Arc<Mutex<Vec<(String, serde_json::Value)>>>,
    }
    impl PartyEvents for TestEvents {
        fn emit(&self, event: &str, payload: serde_json::Value) {
            self.log.lock().unwrap().push((event.to_string(), payload));
        }
    }
    impl TestEvents {
        fn matching(&self, name: &str) -> Vec<serde_json::Value> {
            self.log
                .lock()
                .unwrap()
                .iter()
                .filter(|(n, _)| n == name)
                .map(|(_, p)| p.clone())
                .collect()
        }
        /// Был ли получен снимок листа с данным именем персонажа и непустыми данными.
        fn snapshot_named(&self, name: &str) -> bool {
            self.matching("party://snapshot")
                .iter()
                .any(|p| p["characterName"] == name && !p["data"].is_null())
        }
        /// Был ли получен «снятый» снимок (data: null) от участника `from`.
        fn cleared_from(&self, from: &str) -> bool {
            self.matching("party://snapshot")
                .iter()
                .any(|p| p["from"] == from && p["data"].is_null())
        }
        /// Участники из последнего полученного `party://state`.
        fn latest_members(&self) -> Vec<serde_json::Value> {
            self.matching("party://state")
                .into_iter()
                .last()
                .and_then(|s| s["members"].as_array().cloned())
                .unwrap_or_default()
        }
        /// Сколько участников с данным именем и (опц.) статусом online в последнем ростере.
        fn count_named(&self, name: &str, online: Option<bool>) -> usize {
            self.latest_members()
                .iter()
                .filter(|m| m["displayName"] == name && online.map_or(true, |o| m["online"] == o))
                .count()
        }
    }

    /// Поллинг условия до ~1с (события прилетают из спавненых задач).
    async fn until(mut f: impl FnMut() -> bool) -> bool {
        for _ in 0..50 {
            if f() {
                return true;
            }
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
        false
    }

    /// Хелпер: поднять хост на эфемерном порту (port 0) с заданным секретом.
    async fn start_host(events: TestEvents, secret: &str) -> host::HostHandle {
        host::start(events, Some(0), secret.to_string(), "GM".to_string(), "Test Party".to_string())
            .await
            .expect("host should start")
    }

    #[test]
    fn welcome_then_peer_join_on_valid_handshake() {
        tauri::async_runtime::block_on(async {
            let host_ev = TestEvents::default();
            let host = start_host(host_ev.clone(), "secret-1").await;

            let client_ev = TestEvents::default();
            client::start(
                client_ev.clone(),
                "127.0.0.1".to_string(),
                host.port,
                "secret-1".to_string(),
                "Alice".to_string(),
            )
            .await
            .expect("client should connect");

            // Клиент эмитит connected синхронно до возврата.
            let statuses = client_ev.matching("party://status");
            assert!(
                statuses.iter().any(|p| p["state"] == "connected"),
                "expected connected status, got {statuses:?}"
            );

            // Хост эмитит join из спавненой задачи — ждём до ~1с.
            let mut joined = false;
            for _ in 0..50 {
                if host_ev
                    .matching("party://peer")
                    .iter()
                    .any(|p| p["event"] == "join" && p["displayName"] == "Alice")
                {
                    joined = true;
                    break;
                }
                tokio::time::sleep(Duration::from_millis(20)).await;
            }
            assert!(
                joined,
                "host should emit peer join; got {:?}",
                host_ev.matching("party://peer")
            );
        });
    }

    #[test]
    fn reject_on_bad_code() {
        tauri::async_runtime::block_on(async {
            let host = start_host(TestEvents::default(), "right").await;

            let client_ev = TestEvents::default();
            let res = client::start(
                client_ev.clone(),
                "127.0.0.1".to_string(),
                host.port,
                "wrong".to_string(),
                "Bob".to_string(),
            )
            .await;

            assert!(res.is_err(), "join with wrong code must fail");
            let statuses = client_ev.matching("party://status");
            assert!(
                statuses
                    .iter()
                    .any(|p| p["state"] == "rejected" && p["reason"] == "bad-code"),
                "expected rejected/bad-code, got {statuses:?}"
            );
        });
    }

    #[test]
    fn reject_on_protocol_version_mismatch() {
        tauri::async_runtime::block_on(async {
            let host = start_host(TestEvents::default(), "s").await;

            let url = format!("ws://127.0.0.1:{}/", host.port);
            let (mut ws, _) = tokio_tungstenite::connect_async(url.as_str())
                .await
                .expect("raw client should connect");

            // hello с заведомо несовместимой версией протокола → ожидаем reject.
            let bad_hello = serde_json::json!({
                "v": 999, "code": "s", "displayName": "X", "appVersion": "0.0.0"
            });
            ws.send(Message::text(bad_hello.to_string())).await.unwrap();

            let reply = ws.next().await.expect("a reply frame").expect("ok frame");
            let text = match reply {
                Message::Text(t) => t.as_str().to_string(),
                other => panic!("unexpected frame: {other:?}"),
            };
            let v: serde_json::Value = serde_json::from_str(&text).unwrap();
            assert_eq!(v["type"], "reject");
            assert_eq!(v["reason"], "version-mismatch");
        });
    }

    #[test]
    fn roster_broadcast_reaches_client_and_host() {
        tauri::async_runtime::block_on(async {
            let host_ev = TestEvents::default();
            // gm_name "Gandalf" задаётся внутри start_host? нет — фиксируем явно тут.
            let host = host::start(
                host_ev.clone(),
                Some(0),
                "code".to_string(),
                "Gandalf".to_string(),
                "Fellowship".to_string(),
            )
            .await
            .expect("host should start");

            let client_ev = TestEvents::default();
            client::start(
                client_ev.clone(),
                "127.0.0.1".to_string(),
                host.port,
                "code".to_string(),
                "Frodo".to_string(),
            )
            .await
            .expect("client should connect");

            // Клиент должен получить party-state с ГМ + собой (online).
            let mut ok = false;
            for _ in 0..50 {
                if let Some(state) = client_ev.matching("party://state").into_iter().last() {
                    let members = state["members"].as_array().cloned().unwrap_or_default();
                    let has_gm = members
                        .iter()
                        .any(|m| m["role"] == "gm" && m["displayName"] == "Gandalf");
                    let has_player = members.iter().any(|m| {
                        m["role"] == "player" && m["displayName"] == "Frodo" && m["online"] == true
                    });
                    if has_gm && has_player {
                        ok = true;
                        break;
                    }
                }
                tokio::time::sleep(Duration::from_millis(20)).await;
            }
            assert!(
                ok,
                "client should receive roster with GM + player; got {:?}",
                client_ev.matching("party://state")
            );

            // Хост тоже видит игрока в составе.
            let host_states = host_ev.matching("party://state");
            let last = host_states.last().expect("host emits party://state");
            let members = last["members"].as_array().cloned().unwrap_or_default();
            assert!(
                members.iter().any(|m| m["displayName"] == "Frodo"),
                "host roster should include player; got {members:?}"
            );
        });
    }

    #[test]
    fn snapshot_visibility_matrix_and_replay() {
        tauri::async_runtime::block_on(async {
            let host_ev = TestEvents::default();
            let host = host::start(
                host_ev.clone(),
                Some(0),
                "code".to_string(),
                "GM".to_string(),
                "Party".to_string(),
            )
            .await
            .expect("host should start");

            // Alice (id 1) и Bob (id 2) — последовательное подключение даёт стабильные id.
            let a_ev = TestEvents::default();
            let alice = client::start(
                a_ev.clone(),
                "127.0.0.1".to_string(),
                host.port,
                "code".to_string(),
                "Alice".to_string(),
            )
            .await
            .expect("alice connects");
            let b_ev = TestEvents::default();
            let _bob = client::start(
                b_ev.clone(),
                "127.0.0.1".to_string(),
                host.port,
                "code".to_string(),
                "Bob".to_string(),
            )
            .await
            .expect("bob connects");

            let share = |name: &str, vis: &str| {
                let msg = serde_json::json!({
                    "type": "member-snapshot", "characterId": "c1", "characterName": name,
                    "visibility": vis, "data": { "name": name, "hitPoints": { "current": 5, "max": 10 } }
                });
                alice.out_tx.send(msg.to_string()).unwrap();
            };

            // party → видят и ГМ, и Bob.
            share("PartyChar", "party");
            assert!(until(|| host_ev.snapshot_named("PartyChar")).await, "GM sees party snapshot");
            assert!(until(|| b_ev.snapshot_named("PartyChar")).await, "Bob sees party snapshot");

            // gm → видит только ГМ; у Bob прежний party-снимок СНИМАЕТСЯ, и данных gm он не видит.
            share("GmChar", "gm");
            assert!(until(|| host_ev.snapshot_named("GmChar")).await, "GM sees gm snapshot");
            assert!(until(|| b_ev.cleared_from("1")).await, "Bob's prior snapshot must be cleared on switch to gm");
            assert!(!until(|| b_ev.snapshot_named("GmChar")).await, "Bob must NOT see gm snapshot data");

            // hidden → снятие (data: null) у ГМ и Bob.
            share("HiddenChar", "hidden");
            assert!(until(|| host_ev.cleared_from("1")).await, "GM gets cleared snapshot");
            assert!(until(|| b_ev.cleared_from("1")).await, "Bob gets cleared snapshot");

            // Догон: новый клиент получает уже опубликованный party-снимок.
            share("PartyAgain", "party");
            assert!(until(|| host_ev.snapshot_named("PartyAgain")).await, "GM sees re-share");
            let c_ev = TestEvents::default();
            let _carol = client::start(
                c_ev.clone(),
                "127.0.0.1".to_string(),
                host.port,
                "code".to_string(),
                "Carol".to_string(),
            )
            .await
            .expect("carol connects");
            assert!(until(|| c_ev.snapshot_named("PartyAgain")).await, "late joiner gets replay");
        });
    }

    #[test]
    fn reconnect_same_name_replaces_offline_ghost() {
        tauri::async_runtime::block_on(async {
            let host_ev = TestEvents::default();
            let host = start_host(host_ev.clone(), "code").await;

            // Alice подключается.
            let a1_ev = TestEvents::default();
            let alice1 = client::start(
                a1_ev.clone(),
                "127.0.0.1".to_string(),
                host.port,
                "code".to_string(),
                "Alice".to_string(),
            )
            .await
            .expect("alice connects");
            assert!(
                until(|| host_ev.count_named("Alice", Some(true)) == 1).await,
                "Alice online in roster"
            );

            // Alice отключается (обрываем её задачи → WS закрывается).
            for task in &alice1.tasks {
                task.abort();
            }
            drop(alice1);
            assert!(
                until(|| host_ev.count_named("Alice", Some(false)) == 1).await,
                "host marks Alice offline (ghost)"
            );

            // Alice переподключается с тем же именем — призрак должен исчезнуть.
            let a2_ev = TestEvents::default();
            let _alice2 = client::start(
                a2_ev.clone(),
                "127.0.0.1".to_string(),
                host.port,
                "code".to_string(),
                "Alice".to_string(),
            )
            .await
            .expect("alice reconnects");
            assert!(
                until(|| {
                    host_ev.count_named("Alice", None) == 1 && host_ev.count_named("Alice", Some(true)) == 1
                })
                .await,
                "exactly one online Alice after reconnect; got {:?}",
                host_ev.latest_members()
            );
        });
    }
}
