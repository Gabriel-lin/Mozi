use tauri::{AppHandle, Manager, Emitter};
use tauri::menu::{Menu, MenuBuilder, MenuItem, SubmenuBuilder, CheckMenuItem};
use std::sync::Mutex;
use std::sync::LazyLock;

// 全局主题状态
static CURRENT_THEME: LazyLock<Mutex<String>> = LazyLock::new(|| Mutex::new("system".to_string()));

// 全局语言状态
static CURRENT_LANG: LazyLock<Mutex<String>> = LazyLock::new(|| Mutex::new("zh".to_string()));

// 获取当前语言
pub fn get_current_language() -> String {
    CURRENT_LANG.lock().unwrap().clone()
}

// 设置当前语言
pub fn set_current_language(lang: &str) {
    *CURRENT_LANG.lock().unwrap() = lang.to_string();
}

// 获取当前主题
pub fn get_current_theme() -> String {
    CURRENT_THEME.lock().unwrap().clone()
}

// 设置当前主题
pub fn set_current_theme(theme: &str) {
    *CURRENT_THEME.lock().unwrap() = theme.to_string();
}

// 构建应用菜单
pub fn build_app_menu(app: &AppHandle) -> Result<Menu<tauri::Wry>, tauri::Error> {
    // 获取当前全屏状态
    let is_fullscreen = app
      .get_webview_window("main")
      .map(|w| w.is_fullscreen().unwrap_or(false))
      .unwrap_or(false);

    // 获取当前主题
    let current_theme = get_current_theme();

    // 根据当前主题设置复选标记
    let is_dark = current_theme == "dark";
    let is_light = current_theme == "light";
    let is_system = current_theme == "system";

    // 获取当前语言
    let current_lang = get_current_language();
    let is_lang_zh = current_lang == "zh";

    // 根据语言设置菜单文本
    let (file_text, edit_text, view_text, help_text, profile_text, theme_text, dark_text, light_text, system_text,
         lang_text, _zh_text, _en_text, quit_text, reload_text, fullscreen_text, about_text, exit_fullscreen_text) =
        if is_lang_zh {
            ("文件", "编辑", "视图", "帮助", "个人资料", "主题", "暗夜主题", "亮色主题", "系统主题",
             "语言", "中文", "English", "退出", "重新加载", "全屏", "关于", "退出全屏")
        } else {
            ("File", "Edit", "View", "Help", "Profile", "Theme", "Dark", "Light", "System",
             "Language", "中文", "English", "Quit", "Reload", "Fullscreen", "About", "Exit Fullscreen")
        };

    let fullscreen_label = if is_fullscreen { exit_fullscreen_text } else { fullscreen_text };

    // 创建主题子菜单
    let theme_check_dark = CheckMenuItem::with_id(
      app,
      "theme_dark",
      dark_text,
      true,
      is_dark,
      None::<&str>,
    )?;

    let theme_check_light = CheckMenuItem::with_id(
      app,
      "theme_light",
      light_text,
      true,
      is_light,
      None::<&str>,
    )?;

    let theme_check_system = CheckMenuItem::with_id(
      app,
      "theme_system",
      system_text,
      true,
      is_system,
      None::<&str>,
    )?;

    let theme_submenu = SubmenuBuilder::new(app, theme_text)
        .item(&theme_check_dark)
        .item(&theme_check_light)
        .item(&theme_check_system)
        .build()?;

    // 创建语言子菜单
    let lang_check_zh = CheckMenuItem::with_id(
      app,
      "lang_zh",
      "中文",
      true,
      current_lang == "zh",
      None::<&str>,
    )?;

    let lang_check_en = CheckMenuItem::with_id(
      app,
      "lang_en",
      "English",
      true,
      current_lang == "en",
      None::<&str>,
    )?;

    let lang_submenu = SubmenuBuilder::new(app, lang_text)
        .item(&lang_check_zh)
        .item(&lang_check_en)
        .build()?;

    // 创建偏好子菜单
    let profile_item = MenuItem::with_id(
      app,
      "profile",
      profile_text,
      true,
      None::<&str>,
    )?;

    let preferences_menu = SubmenuBuilder::new(app, if is_lang_zh { "偏好" } else { "Preferences" })
      .item(&profile_item)
      .separator()
      .item(&theme_submenu)
      .separator()
      .item(&lang_submenu)
      .build()?;

    // 创建文件子菜单
    let quit_item = MenuItem::with_id(
      app,
      "quit",
      quit_text,
      true,
      Some("CmdOrCtrl+Q"),
    )?;

    let file_menu = SubmenuBuilder::new(app, file_text)
      .item(&preferences_menu)
      .separator()
      .item(&quit_item)
      .build()?;

    // 创建编辑子菜单
    let edit_menu = SubmenuBuilder::new(app, edit_text)
      .undo()
      .redo()
      .separator()
      .cut()
      .copy()
      .paste()
      .select_all()
      .build()?;

    // 创建视图子菜单
    let reload_item = MenuItem::with_id(
      app,
      "reload",
      reload_text,
      true,
      Some("CmdOrCtrl+R"),
    )?;

    let fullscreen_item = MenuItem::with_id(
      app,
      "fullscreen",
      fullscreen_label,
      true,
      Some("F11"),
    )?;

    let view_menu = SubmenuBuilder::new(app, view_text)
      .item(&reload_item)
      .item(&fullscreen_item)
      .build()?;

    // 创建帮助子菜单
    let about_item = MenuItem::with_id(
      app,
      "about",
      about_text,
      true,
      None::<&str>,
    )?;

    let help_menu = SubmenuBuilder::new(app, help_text)
      .item(&about_item)
      .build()?;

    // 创建主菜单
    MenuBuilder::new(app)
      .items(&[&file_menu, &edit_menu, &view_menu, &help_menu])
      .build()
}

// 处理菜单事件
pub fn handle_menu_event(app: &AppHandle, menu_id: &str) {
    match menu_id {
      "quit" => {
        app.exit(0);
      }
      "reload" => {
        if let Some(window) = app.get_webview_window("main") {
          let _ = window.eval("window.location.reload();");
        }
      }
      "fullscreen" => {
        if let Some(window) = app.get_webview_window("main") {
          let is_fullscreen = window.is_fullscreen().unwrap_or(false);
          log::info!("Current fullscreen state: {}, toggling to: {}", is_fullscreen, !is_fullscreen);
          match window.set_fullscreen(!is_fullscreen) {
            Ok(_) => {
              log::info!("Fullscreen toggled successfully");
            }
            Err(e) => {
              log::error!("Failed to toggle fullscreen: {}", e);
            }
          }

          // 重新构建菜单以更新文本
          if let Ok(new_menu) = build_app_menu(app) {
            let _ = app.set_menu(new_menu);
          }
        }
      }
      "about" => {
        let _ = app.emit("show-about", ());
      }
      "profile" => {
        let _ = app.emit("show-profile", ());
      }
      "theme_dark" => {
        set_current_theme("dark");
        let _ = app.emit("set-theme", "dark");
        if let Ok(new_menu) = build_app_menu(app) {
          let _ = app.set_menu(new_menu);
        }
      }
      "theme_light" => {
        set_current_theme("light");
        let _ = app.emit("set-theme", "light");
        if let Ok(new_menu) = build_app_menu(app) {
          let _ = app.set_menu(new_menu);
        }
      }
      "theme_system" => {
        set_current_theme("system");
        let _ = app.emit("set-theme", "system");
        if let Ok(new_menu) = build_app_menu(app) {
          let _ = app.set_menu(new_menu);
        }
      }
      "lang_zh" => {
        set_current_language("zh");
        let _ = app.emit("set-language", "zh");
        if let Ok(new_menu) = build_app_menu(app) {
          let _ = app.set_menu(new_menu);
        }
      }
      "lang_en" => {
        set_current_language("en");
        let _ = app.emit("set-language", "en");
        if let Ok(new_menu) = build_app_menu(app) {
          let _ = app.set_menu(new_menu);
        }
      }
      _ => {}
    }
}
