//! LAN-автообнаружение по UDP-броадкасту (LP4). Работает ТОЛЬКО в реальной локалке —
//! через VPN (Radmin/Tailscale/ZeroTier) броадкаст обычно не ходит, там по-прежнему
//! подключаются по коду. Хост (если `discoverable`) отвечает на пробы клиента своим
//! `{partyName, port, secret}`; клиент шлёт пробу на броадкаст-адрес и собирает ответы.
//! Адрес хоста берём из источника ответа, поэтому в полезной нагрузке IP не нужен.

use std::collections::HashSet;
use std::time::Duration;

use serde_json::{json, Value};
use tokio::net::UdpSocket;

use super::protocol::PROTOCOL_VERSION;

/// Фиксированный UDP-порт обнаружения (рядом с WS-портом по умолчанию 47331).
pub const DISCOVERY_PORT: u16 = 47332;
/// Маркер пробы (версионируем, чтобы не путаться с чужим трафиком/версией приложения).
const PROBE: &[u8] = b"DND-PARTY-DISCOVER/2";

/// Хост: слушает пробы на `DISCOVERY_PORT` и отвечает описанием партии. JoinHandle
/// обрывается вместе с сессией (`stop_active`). Если порт занят — тихо не анонсим.
pub fn start_responder(
    party_name: String,
    ws_port: u16,
    secret: String,
) -> tauri::async_runtime::JoinHandle<()> {
    tauri::async_runtime::spawn(async move {
        let sock = match UdpSocket::bind(("0.0.0.0", DISCOVERY_PORT)).await {
            Ok(s) => s,
            Err(_) => return,
        };
        let reply = json!({
            "v": PROTOCOL_VERSION, "partyName": party_name, "port": ws_port, "secret": secret
        })
        .to_string();
        let mut buf = [0u8; 256];
        loop {
            match sock.recv_from(&mut buf).await {
                Ok((n, addr)) if &buf[..n] == PROBE => {
                    let _ = sock.send_to(reply.as_bytes(), addr).await;
                }
                Ok(_) => {}
                Err(_) => break,
            }
        }
    })
}

/// Клиент: шлёт пробу на броадкаст и собирает ответы в течение `timeout`. Адрес
/// хоста — источник ответа; дедуп по `host:port`. Возвращает `[{partyName,host,port,secret}]`.
pub async fn scan(timeout: Duration) -> Vec<Value> {
    let sock = match UdpSocket::bind(("0.0.0.0", 0)).await {
        Ok(s) => s,
        Err(_) => return vec![],
    };
    if sock.set_broadcast(true).is_err() {
        return vec![];
    }
    let _ = sock.send_to(PROBE, ("255.255.255.255", DISCOVERY_PORT)).await;

    let mut out: Vec<Value> = vec![];
    let mut seen: HashSet<String> = HashSet::new();
    let deadline = tokio::time::Instant::now() + timeout;
    let mut buf = [0u8; 512];
    loop {
        let remaining = deadline.saturating_duration_since(tokio::time::Instant::now());
        if remaining.is_zero() {
            break;
        }
        match tokio::time::timeout(remaining, sock.recv_from(&mut buf)).await {
            Ok(Ok((n, addr))) => {
                let Ok(val) = serde_json::from_slice::<Value>(&buf[..n]) else { continue };
                if val.get("v").and_then(|v| v.as_u64()) != Some(PROTOCOL_VERSION as u64) {
                    continue;
                }
                let port = val.get("port").and_then(|v| v.as_u64()).unwrap_or(0);
                let host = addr.ip().to_string();
                if seen.insert(format!("{host}:{port}")) {
                    out.push(json!({
                        "partyName": val.get("partyName").and_then(|v| v.as_str()).unwrap_or(""),
                        "host": host,
                        "port": port,
                        "secret": val.get("secret").and_then(|v| v.as_str()).unwrap_or(""),
                    }));
                }
            }
            Ok(Err(_)) | Err(_) => break,
        }
    }
    out
}
