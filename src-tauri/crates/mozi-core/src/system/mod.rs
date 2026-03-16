#![allow(dead_code, unused_imports)]
//! # System 子系统
//!
//! 采集宿主机各维度的实时信息。
//!
//! ## 模块结构
//!
//! ```text
//! system/
//!  ├── info.rs       ← SystemInfo / ProcessInfo / get_system_info()（CPU/内存/进程）
//!  ├── appearance.rs ← get_system_dark_mode() + is_dark_mode()（深色模式检测）
//!  ├── os.rs         ← OsInfo / get_os_info()（平台/版本/架构/主机名/运行时长）
//!  ├── disk.rs       ← DiskInfo / get_disk_info()（磁盘分区/容量/使用率）
//!  └── network.rs    ← NetworkInterface / get_network_info()（网卡/IP/流量统计）
//! ```

pub mod appearance;
pub mod disk;
pub mod info;
pub mod network;
pub mod os;

pub use disk::DiskInfo;
pub use info::{ProcessInfo, SystemInfo};
pub use network::NetworkInterface;
pub use os::OsInfo;

pub use appearance::{get_system_dark_mode, is_dark_mode};
pub use disk::get_disk_info;
pub use info::get_system_info;
pub use network::get_network_info;
pub use os::get_os_info;
