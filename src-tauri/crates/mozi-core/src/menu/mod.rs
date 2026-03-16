use std::sync::LazyLock;
use std::sync::Mutex;

// 全局主题状态
static CURRENT_THEME: LazyLock<Mutex<String>> = LazyLock::new(|| Mutex::new("system".to_string()));

// 全局语言状态
static CURRENT_LANG: LazyLock<Mutex<String>> = LazyLock::new(|| Mutex::new("zh".to_string()));

// 设置当前语言
pub fn set_current_language(lang: &str) {
    *CURRENT_LANG.lock().unwrap() = lang.to_string();
}

// 设置当前主题
pub fn set_current_theme(theme: &str) {
    *CURRENT_THEME.lock().unwrap() = theme.to_string();
}
