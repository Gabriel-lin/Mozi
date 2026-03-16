#![allow(dead_code)]
//! # 操作系统信息（OS）
//!
//! 采集宿主机的平台标识、内核版本、架构、主机名及运行时长，
//! 供前端展示"关于"面板或供 Agent 决策时感知运行环境。

use serde::Serialize;
use sysinfo::System;

// ─────────────────────────── 数据结构 ────────────────────────────────────────

/// 操作系统静态信息快照
#[derive(Debug, Clone, Serialize)]
pub struct OsInfo {
    /// 操作系统名称（如 "Linux"、"Windows"、"macOS"）
    pub os_name: String,
    /// 内核 / 系统版本号（如 "6.6.87"、"10.0.19045"）
    pub os_version: String,
    /// 内核版本字符串（Linux: `uname -r` 风格）
    pub kernel_version: String,
    /// CPU 架构（"x86_64"、"aarch64"、"arm" 等）
    pub arch: String,
    /// 主机名
    pub hostname: String,
    /// 系统运行时长（秒）
    pub uptime_secs: u64,
    /// 逻辑 CPU 核心数
    pub cpu_count: usize,
}

// ─────────────────────────── Tauri 命令 ──────────────────────────────────────

/// 采集操作系统信息
pub fn get_os_info() -> OsInfo {
    OsInfo {
        os_name: System::name().unwrap_or_else(|| "Unknown".into()),
        os_version: System::os_version().unwrap_or_else(|| "Unknown".into()),
        kernel_version: System::kernel_version().unwrap_or_else(|| "Unknown".into()),
        arch: std::env::consts::ARCH.to_string(),
        hostname: System::host_name().unwrap_or_else(|| "Unknown".into()),
        uptime_secs: System::uptime(),
        cpu_count: num_cpus(),
    }
}

// ── 内部工具 ──────────────────────────────────────────────────────────────────

fn num_cpus() -> usize {
    let sys = System::new();
    sys.cpus().len().max(1)
}
