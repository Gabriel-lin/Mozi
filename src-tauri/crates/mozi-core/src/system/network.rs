#![allow(dead_code)]
//! # 网络信息（Network）
//!
//! 枚举宿主机所有网络接口，采集 MAC 地址、IP 地址列表及收发流量统计。

use serde::Serialize;
use sysinfo::Networks;

// ─────────────────────────── 数据结构 ────────────────────────────────────────

/// 单个网络接口信息
#[derive(Debug, Clone, Serialize)]
pub struct NetworkInterface {
    /// 接口名称（如 "eth0"、"wlan0"、"lo"）
    pub name: String,
    /// MAC 地址（格式 "xx:xx:xx:xx:xx:xx"；无法获取时为空字符串）
    pub mac_address: String,
    /// 本次刷新周期内接收的字节数
    pub received_bytes: u64,
    /// 本次刷新周期内发送的字节数
    pub transmitted_bytes: u64,
    /// 累计接收字节数（自系统启动）
    pub total_received_bytes: u64,
    /// 累计发送字节数（自系统启动）
    pub total_transmitted_bytes: u64,
    /// 接收数据包数（本次周期）
    pub packets_in: u64,
    /// 发送数据包数（本次周期）
    pub packets_out: u64,
}

// ─────────────────────────── Tauri 命令 ──────────────────────────────────────

/// 采集所有网络接口信息
pub fn get_network_info() -> Vec<NetworkInterface> {
    let mut networks = Networks::new_with_refreshed_list();
    networks.refresh(false);

    let mut result: Vec<NetworkInterface> = networks
        .iter()
        .map(|(name, data)| NetworkInterface {
            name: name.clone(),
            mac_address: data.mac_address().to_string(),
            received_bytes: data.received(),
            transmitted_bytes: data.transmitted(),
            total_received_bytes: data.total_received(),
            total_transmitted_bytes: data.total_transmitted(),
            packets_in: data.packets_received(),
            packets_out: data.packets_transmitted(),
        })
        .collect();

    // 排序：回环接口（lo）放最后，其余按名称字母排序
    result.sort_by(|a, b| {
        let a_lo = a.name == "lo";
        let b_lo = b.name == "lo";
        match (a_lo, b_lo) {
            (true, false) => std::cmp::Ordering::Greater,
            (false, true) => std::cmp::Ordering::Less,
            _ => a.name.cmp(&b.name),
        }
    });

    result
}
