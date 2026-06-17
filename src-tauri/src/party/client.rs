//! Клиент party-сессии: WS-клиент на tokio. Подключается к `ws://host:port`,
//! шлёт hello, ждёт welcome/reject, затем ретранслирует кадры между фронтом и
//! хостом. Статусы рукопожатия и обрыв уходят событием `party://status` в
//! абстрактный `PartyEvents` (в проде — `AppHandle`, в тестах — мок-сток).

use futures_util::{SinkExt, StreamExt};
use serde_json::json;
use tauri::async_runtime::JoinHandle;
use tokio::sync::mpsc;
use tokio_tungstenite::tungstenite::Message;

use super::protocol::{Handshake, Hello, PROTOCOL_VERSION};
use super::PartyEvents;

/// Дескриптор активного клиента, который держит `PartyState`.
pub struct ClientHandle {
    /// Фронт → хост.
    pub out_tx: mpsc::UnboundedSender<String>,
    pub tasks: Vec<JoinHandle<()>>,
}

pub async fn start<E: PartyEvents>(
    events: E,
    host: String,
    port: u16,
    secret: String,
    display_name: String,
) -> Result<ClientHandle, String> {
    let url = format!("ws://{host}:{port}/");
    let (ws, _resp) = tokio_tungstenite::connect_async(url.as_str())
        .await
        .map_err(|e| format!("connect {url}: {e}"))?;
    let (mut write, mut read) = ws.split();

    // Рукопожатие: шлём hello…
    let hello = serde_json::to_string(&Hello {
        v: PROTOCOL_VERSION,
        code: secret,
        display_name,
        app_version: env!("CARGO_PKG_VERSION").to_string(),
    })
    .map_err(|e| e.to_string())?;
    write
        .send(Message::text(hello))
        .await
        .map_err(|e| e.to_string())?;

    // …и ждём ответ хоста (welcome/reject).
    let reply = read
        .next()
        .await
        .ok_or_else(|| "connection closed before welcome".to_string())?
        .map_err(|e| e.to_string())?;
    let text = match reply {
        Message::Text(t) => t.as_str().to_string(),
        _ => return Err("expected text handshake reply".into()),
    };
    match serde_json::from_str::<Handshake>(&text).map_err(|e| format!("bad handshake: {e}"))? {
        Handshake::Reject { reason, .. } => {
            events.emit("party://status", json!({ "state": "rejected", "reason": reason }));
            return Err(format!("rejected by host: {reason}"));
        }
        Handshake::Welcome { self_id, .. } => {
            events.emit("party://status", json!({ "state": "connected", "selfId": self_id }));
        }
    }

    // Исходящие: фронт → хост.
    let (out_tx, mut out_rx) = mpsc::unbounded_channel::<String>();
    let writer = tauri::async_runtime::spawn(async move {
        while let Some(text) = out_rx.recv().await {
            if write.send(Message::text(text)).await.is_err() {
                break;
            }
        }
    });

    // Входящие: хост → фронт. `party-state` (состав партии) уходит отдельным
    // событием `party://state`, всё прочее — как непрозрачное `party://message`.
    // По завершению цикла — пометить партию закрытой.
    let events_r = events.clone();
    let reader = tauri::async_runtime::spawn(async move {
        while let Some(frame) = read.next().await {
            match frame {
                Ok(Message::Text(t)) => {
                    let raw = t.as_str().to_string();
                    match serde_json::from_str::<serde_json::Value>(&raw) {
                        Ok(val) if val.get("type").and_then(|v| v.as_str()) == Some("party-state") => {
                            events_r.emit("party://state", val);
                        }
                        Ok(val) if val.get("type").and_then(|v| v.as_str()) == Some("party-snapshot") => {
                            events_r.emit("party://snapshot", val);
                        }
                        Ok(val) if val.get("type").and_then(|v| v.as_str()) == Some("party-event") => {
                            events_r.emit("party://event", val.get("event").cloned().unwrap_or(val));
                        }
                        Ok(val) => events_r.emit("party://message", json!({ "data": val })),
                        Err(_) => events_r.emit("party://message", json!({ "data": raw })),
                    }
                }
                Ok(Message::Close(_)) | Err(_) => break,
                _ => {}
            }
        }
        events_r.emit("party://status", json!({ "state": "closed" }));
    });

    Ok(ClientHandle {
        out_tx,
        tasks: vec![writer, reader],
    })
}
