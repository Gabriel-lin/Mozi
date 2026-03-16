#![allow(dead_code)]
//! # 外观 / 主题检测（Appearance）
//!
//! 读取操作系统**实际**的深色模式偏好（不受 tauri-plugin-appearance 强制覆盖影响）。
//!
//! ## 检测优先级（Linux）
//!
//! 1. `gsettings org.gnome.desktop.interface color-scheme`（GNOME / freedesktop）
//! 2. `~/.config/gtk-3.0/settings.ini` 中的 `gtk-application-prefer-dark-theme`
//! 3. `$GTK_THEME` 环境变量（以 `:dark` 结尾视为深色）
//! 4. 默认返回 `false`（浅色）

use std::path::Path;

// ─────────────────────────── 内部检测函数 ────────────────────────────────────

/// 通过 `gsettings` 读取 GNOME color-scheme（freedesktop 标准）
fn detect_via_gsettings() -> Option<bool> {
    let out = std::process::Command::new("gsettings")
        .args(["get", "org.gnome.desktop.interface", "color-scheme"])
        .output()
        .ok()?;

    let s = String::from_utf8_lossy(&out.stdout).to_lowercase();
    if s.contains("prefer-dark") {
        return Some(true);
    }
    if s.contains("prefer-light") || s.contains("default") {
        return Some(false);
    }
    None
}

/// 解析 `~/.config/gtk-3.0/settings.ini` 中的 GTK 深色主题偏好
fn detect_via_gtk3_ini() -> Option<bool> {
    let home = std::env::var_os("HOME")?;
    let path = Path::new(&home).join(".config/gtk-3.0/settings.ini");
    let content = std::fs::read_to_string(path).ok()?;

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("gtk-application-prefer-dark-theme") && trimmed.contains('=') {
            let val = trimmed.split('=').last()?.trim();
            return Some(val == "1" || val.eq_ignore_ascii_case("true"));
        }
    }
    None
}

/// 读取 `$GTK_THEME` 环境变量（部分 DE 通过此变量传递主题）
fn detect_via_gtk_theme_env() -> Option<bool> {
    let theme = std::env::var("GTK_THEME").ok()?;
    Some(theme.to_lowercase().ends_with(":dark"))
}

// ─────────────────────────── 公开 API ────────────────────────────────────────

/// 读取当前操作系统的深色模式偏好
///
/// 按优先级依次尝试各检测方法；所有方法均无法确定时返回 `false`（浅色）。
pub fn is_dark_mode() -> bool {
    detect_via_gsettings()
        .or_else(detect_via_gtk3_ini)
        .or_else(detect_via_gtk_theme_env)
        .unwrap_or(false)
}

/// 返回操作系统深色模式偏好
pub fn get_system_dark_mode() -> bool {
    is_dark_mode()
}
