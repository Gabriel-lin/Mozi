mod menu;
mod system;
use menu::{set_current_language, set_current_theme, build_app_menu};
use system::get_system_info;
use tauri::{Listener};
use tauri_plugin_appearance::Theme;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut ctx = tauri::generate_context!();
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_system_info])
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
            // 监听主题变更事件，同步到系统
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

            // 监听语言变更事件
            app.listen("set-language", move |event: tauri::Event| {
                let lang_str = event.payload().trim_matches('"');
                match lang_str {
                    "zh" | "en" => {
                        set_current_language(lang_str);
                    }
                    _ => {}
                }
            });

            // 监听重建菜单事件
            let app_handle_for_menu = app.handle().clone();
            app.listen("rebuild-menu", move |_event: tauri::Event| {
                if let Ok(new_menu) = build_app_menu(&app_handle_for_menu) {
                    let _ = app_handle_for_menu.set_menu(new_menu);
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
