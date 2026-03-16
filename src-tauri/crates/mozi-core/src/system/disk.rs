#![allow(dead_code)]
//! # 磁盘信息（Disk）
//!
//! 枚举宿主机所有已挂载磁盘分区，采集容量、已用空间、文件系统类型等信息。

use serde::Serialize;
use sysinfo::Disks;

// ─────────────────────────── 数据结构 ────────────────────────────────────────

/// 单个磁盘分区信息
#[derive(Debug, Clone, Serialize)]
pub struct DiskInfo {
    /// 设备名称（如 "/dev/sda1"、"C:"）
    pub name: String,
    /// 挂载点（如 "/"、"/home"、"C:\\"）
    pub mount_point: String,
    /// 磁盘总容量（字节）
    pub total_bytes: u64,
    /// 可用空间（字节）
    pub available_bytes: u64,
    /// 已用空间（字节）
    pub used_bytes: u64,
    /// 使用率（0.0 – 100.0）
    pub usage_percent: f32,
    /// 文件系统类型（如 "ext4"、"NTFS"、"apfs"）
    pub fs_type: String,
    /// 是否为可移动设备（U 盘、外置硬盘等）
    pub is_removable: bool,
}

impl DiskInfo {
    fn from_sysinfo(disk: &sysinfo::Disk) -> Self {
        let total = disk.total_space();
        let available = disk.available_space();
        let used = total.saturating_sub(available);
        let usage_percent = if total == 0 {
            0.0
        } else {
            used as f32 / total as f32 * 100.0
        };

        Self {
            name: disk.name().to_string_lossy().to_string(),
            mount_point: disk.mount_point().to_string_lossy().to_string(),
            total_bytes: total,
            available_bytes: available,
            used_bytes: used,
            usage_percent,
            fs_type: disk.file_system().to_string_lossy().to_string(),
            is_removable: disk.is_removable(),
        }
    }
}

// ─────────────────────────── Tauri 命令 ──────────────────────────────────────

/// 采集所有磁盘分区信息
pub fn get_disk_info() -> Vec<DiskInfo> {
    let disks = Disks::new_with_refreshed_list();
    let mut result: Vec<DiskInfo> = disks.iter().map(DiskInfo::from_sysinfo).collect();
    // 按挂载点字母排序，保持稳定展示顺序
    result.sort_by(|a, b| a.mount_point.cmp(&b.mount_point));
    result
}
