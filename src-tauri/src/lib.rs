use std::fs;
use std::io::Write;

#[tauri::command]
fn load_data() -> Result<serde_json::Value, String> {
    match fs::read_to_string("dataset.json") {
        Ok(content) => match serde_json::from_str(&content) {
            Ok(data) => Ok(data),
            Err(e) => Err(format!("Failed to parse JSON: {}", e)),
        },
        Err(_) => Ok(serde_json::json!([])), // Return empty array if file doesn't exist
    }
}

#[tauri::command]
fn save_data(records: serde_json::Value) -> Result<(), String> {
    let json_string = serde_json::to_string_pretty(&records)
        .map_err(|e| format!("Failed to serialize data: {}", e))?;
    fs::write("dataset.json", json_string)
        .map_err(|e| format!("Failed to write to file: {}", e))?;
    Ok(())
}

#[tauri::command]
fn export_jsonl(records: serde_json::Value) -> Result<(), String> {
    if let Some(array) = records.as_array() {
        let mut file = fs::File::create("dataset.jsonl")
            .map_err(|e| format!("Failed to create export file: {}", e))?;
        for item in array {
            let item_str = serde_json::to_string(item)
                .map_err(|e| format!("Failed to serialize item: {}", e))?;
            writeln!(file, "{}", item_str)
                .map_err(|e| format!("Failed to write item: {}", e))?;
        }
        Ok(())
    } else {
        Err("Expected a JSON array".into())
    }
}

#[tauri::command]
fn clear_data() -> Result<(), String> {
    fs::write("dataset.json", "[\n]")
        .map_err(|e| format!("Failed to clear data: {}", e))?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            load_data,
            save_data,
            export_jsonl,
            clear_data
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
