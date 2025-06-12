// use tauri::Manager;

use sysinfo::{System, Pid, Process, LoadAvg};
use serde::Serialize;

#[derive(Serialize)]
struct SystemInfo {
    cpu_usage: f32, // CPU 占用率
    load_avg: (f64, f64, f64), // 系统负载
    processes: Vec<ProcessInfo>, // 调度进程信息
}

#[derive(Serialize)]
struct ProcessInfo {
    pid: i32, // 进程 ID
    name: String, // 进程名称
    cpu_usage: f32, // 进程 CPU 占用率
    memory: u64, // 进程内存占用
}

#[tauri::command]
fn get_system_info() -> SystemInfo {
    let mut sys = System::new_all();
    sys.refresh_all(); // 刷新系统信息

    // 获取 CPU 占用率
    let cpu_usage = sys.global_cpu_usage();

    // 获取系统负载
    let load_avg = System::load_average();
    let load_avg_tuple = (load_avg.one, load_avg.five, load_avg.fifteen);

    // 获取调度进程信息
    let processes = sys.processes()
        .iter()
        .map(|(pid, process)| ProcessInfo {
            pid: pid.as_u32() as i32, // 将 Pid 转换为 i32
            name: process.name().to_string_lossy().to_string(), // 将 OsStr 转换为 String
            cpu_usage: process.cpu_usage(),
            memory: process.memory(),
        })
        .collect();

    SystemInfo {
        cpu_usage,
        load_avg: load_avg_tuple,
        processes,
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![get_system_info]) // 注册命令
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
  
    // info!("Application started"); // 输出信息日志
    // error!("An error occurred"); // 输出错误日志
}
