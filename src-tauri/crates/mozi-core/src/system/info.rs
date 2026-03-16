#![allow(dead_code)]
//! # 系统资源信息（CPU / 内存 / 进程）
//!
//! 提供 `get_system_info()` Tauri 命令，实时采集宿主机的 CPU 占用、
//! 系统负载及进程列表，供前端仪表盘展示。

use serde::Serialize;
use sysinfo::System;

// ─────────────────────────── 数据结构 ────────────────────────────────────────

/// 系统资源快照
#[derive(Debug, Serialize)]
pub struct SystemInfo {
    /// 全局 CPU 占用率（%）
    pub cpu_usage: f32,
    /// 系统 1 / 5 / 15 分钟负载均值
    pub load_avg: (f64, f64, f64),
    /// 物理内存总量（字节）
    pub total_memory: u64,
    /// 已用内存（字节）
    pub used_memory: u64,
    /// 可用内存（字节）
    pub available_memory: u64,
    /// 当前进程列表（按 CPU 占用降序）
    pub processes: Vec<ProcessInfo>,
}

/// 单个进程快照
#[derive(Debug, Serialize)]
pub struct ProcessInfo {
    /// 进程 ID
    pub pid: i32,
    /// 进程名称
    pub name: String,
    /// 进程 CPU 占用率（%）
    pub cpu_usage: f32,
    /// 进程内存占用（字节）
    pub memory: u64,
    /// 进程状态（"run" / "sleep" / "zombie" 等）
    pub status: String,
}

// ─────────────────────────── Tauri 命令 ──────────────────────────────────────

/// 采集系统资源快照
pub fn get_system_info() -> SystemInfo {
    let mut sys = System::new_all();
    sys.refresh_all();

    let cpu_usage = sys.global_cpu_usage();

    let load = System::load_average();
    let load_avg = (load.one, load.five, load.fifteen);

    let total_memory = sys.total_memory();
    let used_memory = sys.used_memory();
    let available_memory = sys.available_memory();

    let mut processes: Vec<ProcessInfo> = sys
        .processes()
        .iter()
        .map(|(pid, proc)| ProcessInfo {
            pid: pid.as_u32() as i32,
            name: proc.name().to_string_lossy().to_string(),
            cpu_usage: proc.cpu_usage(),
            memory: proc.memory(),
            status: format!("{:?}", proc.status()),
        })
        .collect();

    // 按 CPU 占用降序排列，便于前端直接展示 Top-N
    processes.sort_by(|a, b| {
        b.cpu_usage
            .partial_cmp(&a.cpu_usage)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    SystemInfo {
        cpu_usage,
        load_avg,
        total_memory,
        used_memory,
        available_memory,
        processes,
    }
}
