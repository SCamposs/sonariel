use crate::{connect, Core};
use serde_json::{json, Value};
use std::{
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
    time::Duration,
};
use tauri::{ipc::Channel, Manager};
use tauri_plugin_updater::{Update, UpdaterExt};

#[derive(Default)]
pub struct Updates {
    pub installing: AtomicBool,
    available: Mutex<Option<Update>>,
}

struct InstallingGuard<'a>(&'a AtomicBool);
impl Drop for InstallingGuard<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::SeqCst);
    }
}

#[tauri::command]
pub async fn updates_check(
    app: tauri::AppHandle,
    state: tauri::State<'_, Updates>,
) -> Result<Value, String> {
    if state.installing.load(Ordering::SeqCst) {
        return Err("Atualização em andamento".into());
    }
    let update = app
        .updater_builder()
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|e| e.to_string())?
        .check()
        .await
        .map_err(|e| e.to_string())?;
    if let Some(ref candidate) = update {
        // Signed packages are mandatory; additionally restrict the announced URL to our release origin.
        if !candidate
            .download_url
            .as_str()
            .starts_with("https://github.com/SCamposs/sonariel/releases/download/")
        {
            return Err("Origem de atualização não autorizada".into());
        }
    }
    let result = update
        .as_ref()
        .map(|item| json!({"version": item.version, "notes": item.body}))
        .unwrap_or(Value::Null);
    *state.available.lock().map_err(|e| e.to_string())? = update;
    Ok(result)
}

#[tauri::command]
pub async fn updates_install(
    app: tauri::AppHandle,
    state: tauri::State<'_, Updates>,
    version: String,
    on_progress: Channel<Value>,
) -> Result<(), String> {
    if state.installing.swap(true, Ordering::SeqCst) {
        return Err("Atualização já em andamento".into());
    }
    let _guard = InstallingGuard(&state.installing);
    let mut update = state
        .available
        .lock()
        .map_err(|e| e.to_string())?
        .clone()
        .ok_or("Verifique a versão antes de atualizar")?;
    if update.version != version {
        return Err("A versão disponível mudou. Verifique novamente.".into());
    }
    update.timeout = Some(Duration::from_secs(600));
    let mut downloaded: u64 = 0;
    let bytes = update
        .download(
            |length, total| {
                downloaded += length as u64;
                let _ = on_progress
                    .send(json!({"phase":"downloading", "downloaded":downloaded,"total":total}));
            },
            || {},
        )
        .await
        .map_err(|e| format!("Download ou assinatura inválida: {e}"))?;
    // Verify the package before changing the local lifecycle. The core enforces idle queue,
    // completed setup and closed MCP clients under its mutation lock.
    let core = app.state::<Core>();
    let info = connect(&app, &core)?;
    let info_for_shutdown = info.clone();
    tauri::async_runtime::spawn_blocking(move || -> Result<(), String> {
        let client = reqwest::blocking::Client::builder()
            .timeout(Duration::from_secs(20))
            .build()
            .map_err(|e| e.to_string())?;
        let url = info_for_shutdown["url"]
            .as_str()
            .ok_or("Missing core URL")?;
        let token = info_for_shutdown["token"]
            .as_str()
            .ok_or("Missing core token")?;
        let response: Value = client
            .post(format!("{url}/rpc"))
            .bearer_auth(token)
            .json(&json!({"method":"__desktop_prepare_update","args":{}}))
            .send()
            .map_err(|e| e.to_string())?
            .json()
            .map_err(|e| e.to_string())?;
        if let Some(error) = response.get("error") {
            return Err(error.as_str().unwrap_or("Núcleo ocupado").to_owned());
        }
        for _ in 0..100 {
            if client
                .get(format!("{url}/health"))
                .bearer_auth(token)
                .timeout(Duration::from_millis(100))
                .send()
                .is_err()
            {
                // Give the owned Python process time to release its bundled DLLs.
                std::thread::sleep(Duration::from_millis(500));
                return Ok(());
            }
            std::thread::sleep(Duration::from_millis(50));
        }
        Err("O núcleo ainda está encerrando. Tente novamente.".into())
    })
    .await
    .map_err(|e| e.to_string())??;
    *core.connection.lock().map_err(|e| e.to_string())? = None;
    let _ = on_progress.send(json!({"phase":"installing"}));
    // Windows updater exits the app, runs the signed NSIS package and relaunches it.
    update.install(bytes).map_err(|e| e.to_string())
}
