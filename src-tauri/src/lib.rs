use mozi_core::menu::{set_current_language, set_current_theme};
use mozi_core::system;
use tauri::{Listener, Manager};
use tauri_plugin_appearance::Theme;

// ── Tauri command wrappers（委托给 mozi-core 纯函数） ─────────────────────────

#[tauri::command]
fn get_system_info() -> system::SystemInfo {
    system::get_system_info()
}

#[tauri::command]
fn get_system_dark_mode() -> bool {
    system::get_system_dark_mode()
}

#[tauri::command]
fn get_os_info() -> system::OsInfo {
    system::get_os_info()
}

#[tauri::command]
fn get_disk_info() -> Vec<system::DiskInfo> {
    system::get_disk_info()
}

#[tauri::command]
fn get_network_info() -> Vec<system::NetworkInterface> {
    system::get_network_info()
}

// ── Tauri 应用入口 ───────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut ctx = tauri::generate_context!();
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_system_info,
            get_system_dark_mode,
            get_os_info,
            get_disk_info,
            get_network_info,
        ])
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_appearance::init(ctx.config_mut()))
        .setup(|app| {
            use tauri::tray::{TrayIconBuilder, TrayIconEvent};

            let icon = tauri::include_image!("icons/32x32.png");

            TrayIconBuilder::with_id("main")
                .icon(icon)
                .tooltip("Mozi")
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { .. } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            let app_handle_for_theme = app.handle().clone();
            app.listen("set-theme", move |event: tauri::Event| {
                let theme_str = event.payload().trim_matches('"');
                let theme = match theme_str {
                    "dark" => Theme::Dark,
                    "light" => Theme::Light,
                    _ => Theme::Auto,
                };
                set_current_theme(theme_str);
                let _ = tauri_plugin_appearance::set_theme(app_handle_for_theme.clone(), theme);
            });

            app.listen("set-language", move |event: tauri::Event| {
                let lang_str = event.payload().trim_matches('"');
                match lang_str {
                    "zh" | "en" => {
                        set_current_language(lang_str);
                    }
                    _ => {}
                }
            });

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(ctx)
        .expect("error while running tauri application");
}
