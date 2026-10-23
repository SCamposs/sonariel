#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde_json::{json, Value};
use std::{process::Command, sync::Mutex};
use tauri::Manager;
mod updates;

#[derive(Default)]
struct Core {
    connection: Mutex<Option<Value>>,
}

fn connect(app: &tauri::AppHandle, state: &Core) -> Result<Value, String> {
    let mut cached = state.connection.lock().map_err(|e| e.to_string())?;
    if let Some(value) = cached.as_ref() {
        return Ok(value.clone());
    }
    let mut command;
    if cfg!(debug_assertions) {
        let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap();
        command = Command::new(root.join(".venv/Scripts/python.exe"));
        command
            .args(["-m", "sonariel", "connection"])
            .current_dir(root);
    } else {
        let resource = app.path().resource_dir().map_err(|e| e.to_string())?;
        command = Command::new(resource.join("runtime/sonariel-core.exe"));
        command.arg("connection");
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    let output = command.output().map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    let value: Value = serde_json::from_slice(&output.stdout).map_err(|e| e.to_string())?;
    *cached = Some(value.clone());
    Ok(value)
}

#[tauri::command]
async fn rpc(
    app: tauri::AppHandle,
    state: tauri::State<'_, Core>,
    method: String,
    args: Value,
) -> Result<Value, String> {
    if app
        .state::<updates::Updates>()
        .installing
        .load(std::sync::atomic::Ordering::SeqCst)
    {
        return Err("Atualização em andamento. Aguarde o reinício.".into());
    }
    let info = connect(&app, &state)?;
    if method == "__connection" {
        return Ok(info);
    }
    let url = format!("{}/rpc", info["url"].as_str().ok_or("Missing URL")?);
    let token = info["token"].as_str().ok_or("Missing token")?.to_string();
    let args = if method == "codex_register" && !cfg!(debug_assertions) {
        let executable = app
            .path()
            .resource_dir()
            .map_err(|e| e.to_string())?
            .join("runtime/sonariel-core.exe");
        json!({"executable": executable.to_string_lossy()})
    } else {
        args
    };
    tauri::async_runtime::spawn_blocking(move || {
        let client = reqwest::blocking::Client::builder()
            .timeout(std::time::Duration::from_secs(300))
            .build()
            .map_err(|e| e.to_string())?;
        let response: Value = client
            .post(url)
            .bearer_auth(token)
            .json(&json!({"method":method,"args":args}))
            .send()
            .map_err(|e| e.to_string())?
            .json()
            .map_err(|e| e.to_string())?;
        if let Some(error) = response.get("error") {
            return Err(error.as_str().unwrap_or("Core error").to_string());
        }
        Ok(response["result"].clone())
    })
    .await
    .map_err(|e| e.to_string())?
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(Core::default())
        .manage(updates::Updates::default())
        .invoke_handler(tauri::generate_handler![
            rpc,
            updates::updates_check,
            updates::updates_install
        ])
        .run(tauri::generate_context!())
        .expect("Unable to start Sonariel");
}
