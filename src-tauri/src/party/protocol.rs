//! Wire-протокол party-сессии (JSON поверх WebSocket).
//!
//! Версионируется полем `v`: при рукопожатии хост отбивает несовместимые версии
//! приложения (см. `host::handle_client`). LP0 описывает только рукопожатие
//! (`Hello` → `Welcome`/`Reject`); прикладные сообщения (event/member-snapshot
//! из docs/PLAN_PARTY_LOCAL.md) ретранслируются как непрозрачный JSON и появятся
//! в LP1+. Держим `PROTOCOL_VERSION` синхронным с `src/online/protocol.ts`.

use serde::{Deserialize, Serialize};

pub const PROTOCOL_VERSION: u32 = 1;

/// Первый кадр клиента после подключения. `code` — общий секрет партии
/// (деттерент, не настоящая авторизация — см. план).
#[derive(Debug, Serialize, Deserialize)]
pub struct Hello {
    pub v: u32,
    pub code: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
    #[serde(rename = "appVersion", default)]
    pub app_version: String,
}

/// Ответ хоста на рукопожатие. Сериализуется хостом, десериализуется клиентом —
/// один тип на оба конца, чтобы формат не разъезжался.
#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum Handshake {
    Welcome {
        v: u32,
        #[serde(rename = "selfId")]
        self_id: String,
    },
    Reject {
        v: u32,
        reason: String,
    },
}

impl Handshake {
    pub fn reject(reason: &str) -> Self {
        Handshake::Reject {
            v: PROTOCOL_VERSION,
            reason: reason.to_string(),
        }
    }
}
