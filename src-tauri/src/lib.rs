mod system;
mod menu;
use system::{get_system_info};
use menu::{build_app_menu, handle_menu_event};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![get_system_info]) // 注册命令
    .setup(|app| {
      // 构建并设置应用菜单
      let menu = build_app_menu(app.handle())?;
      app.set_menu(menu)?;
      
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .on_menu_event(|app, event| {
      handle_menu_event(app, event.id().0.as_str());
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
  
    // info!("Application started"); // 输出信息日志
    // error!("An error occurred"); // 输出错误日志
}
