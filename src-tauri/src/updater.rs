//! Самообновление десктопа с discovery-индирекцией: куда ходить за манифестом,
//! решает не вшитый адрес, а pointer-файл в Git-репозитории. Потеряв доступ к
//! `.ru`-серверу, достаточно переписать pointer одним коммитом — и уже
//! установленные копии поедут на новый адрес. Кнопка «Проверить обновления» в
//! настройках дёргает `check_update`, подтверждение пользователя — `install_update`.
//!
//! Подпись установщика проверяется публичным ключом из tauri.conf.json
//! (plugins.updater.pubkey). Это корень доверия: какой бы адрес ни выдал pointer,
//! принят будет только бинарь, подписанный соответствующим приватным ключом.

use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};
use tauri_plugin_updater::UpdaterExt;

/// Долговечный указатель: лежит в ветке `updates` репозитория и переживёт смерть
/// `.ru`-сервера. Читаем его первым; адрес сервера здесь не зашит жёстко.
const POINTER_URL: &str =
    "https://raw.githubusercontent.com/AzzyDreamer/dnd-character-manager/updates/endpoint.json";

/// Аварийный адрес на случай, когда недоступен и GitHub (pointer не прочитался).
/// Должен совпадать с endpoint в tauri.conf.json и указывать на актуальный сервер
/// на момент сборки.
const FALLBACK_ENDPOINT: &str = "https://upd.azzydreamer.ru/latest.json";

/// Найденный, но ещё не установленный апдейт. Держим между `check_update` и
/// `install_update`, потому что `Update` не сериализуется через границу команды.
#[derive(Default)]
pub struct UpdaterState {
    pending: Mutex<Option<tauri_plugin_updater::Update>>,
}

/// Формат pointer-файла. Список адресов — чтобы при миграции можно было держать
/// старый и новый сервер одновременно (апдейтер пробует по порядку).
#[derive(Deserialize)]
struct Pointer {
    endpoints: Vec<String>,
}

/// Результат проверки для фронта.
#[derive(Serialize)]
pub struct UpdateInfo {
    available: bool,
    version: String,
    current_version: String,
    notes: Option<String>,
    date: Option<String>,
}

/// Резолв адресов манифеста: pointer с GitHub → его `endpoints`; при любой ошибке
/// (нет сети, GitHub лёг, битый JSON) — вшитый фоллбэк.
async fn resolve_endpoints() -> Vec<String> {
    match fetch_pointer().await {
        Ok(p) if !p.endpoints.is_empty() => p.endpoints,
        _ => vec![FALLBACK_ENDPOINT.to_string()],
    }
}

async fn fetch_pointer() -> Result<Pointer, reqwest::Error> {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()?
        .get(POINTER_URL)
        .send()
        .await?
        .error_for_status()?
        .json::<Pointer>()
        .await
}

#[tauri::command]
pub async fn check_update(
    app: AppHandle,
    state: State<'_, UpdaterState>,
) -> Result<UpdateInfo, String> {
    let endpoints = resolve_endpoints().await;
    let urls = endpoints
        .iter()
        .map(|s| s.parse::<reqwest::Url>().map_err(|e| format!("bad endpoint {s}: {e}")))
        .collect::<Result<Vec<_>, _>>()?;

    let updater = app
        .updater_builder()
        .endpoints(urls)
        .map_err(|e| e.to_string())?
        .build()
        .map_err(|e| e.to_string())?;

    let current = app.package_info().version.to_string();

    match updater.check().await.map_err(|e| e.to_string())? {
        Some(update) => {
            let info = UpdateInfo {
                available: true,
                version: update.version.clone(),
                current_version: current,
                notes: update.body.clone(),
                date: update.date.map(|d| d.to_string()),
            };
            *state.pending.lock().unwrap() = Some(update);
            Ok(info)
        }
        None => Ok(UpdateInfo {
            available: false,
            version: current.clone(),
            current_version: current,
            notes: None,
            date: None,
        }),
    }
}

#[tauri::command]
pub async fn install_update(
    app: AppHandle,
    state: State<'_, UpdaterState>,
) -> Result<(), String> {
    // take(): апдейт одноразовый — после установки приложение перезапускается.
    let update = state
        .pending
        .lock()
        .unwrap()
        .take()
        .ok_or_else(|| "no pending update; call check_update first".to_string())?;

    update
        .download_and_install(|_chunk, _total| {}, || {})
        .await
        .map_err(|e| e.to_string())?;

    // Перезапуск в обновлённую версию. Расходится (-> !), код ниже недостижим.
    app.restart();
}
