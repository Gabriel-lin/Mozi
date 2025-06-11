// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

fn main() {
  // mozi_lib::run();
  tauri::Builder::default()
    .setup(|app| {
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
  // info!("Application started"); // 输出信息日志
  // error!("An error occurred"); // 输出错误日志
}
