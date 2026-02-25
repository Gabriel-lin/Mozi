use tauri::{AppHandle, Manager, Emitter};
use tauri::menu::{Menu, MenuBuilder, MenuItem, SubmenuBuilder};

// 构建应用菜单
pub fn build_app_menu(app: &AppHandle) -> Result<Menu<tauri::Wry>, tauri::Error> {
    // 获取当前全屏状态
    let is_fullscreen = app
      .get_webview_window("main")
      .map(|w| w.is_fullscreen().unwrap_or(false))
      .unwrap_or(false);
    let fullscreen_text = if is_fullscreen { "退出全屏" } else { "全屏" };
  
    // 创建文件子菜单
    let quit_item = MenuItem::with_id(
      app,
      "quit",
      "退出",
      true,
      Some("CmdOrCtrl+Q"),
    )?;
    
    let file_menu = SubmenuBuilder::new(app, "文件")
      .item(&quit_item)
      .build()?;
  
    // 创建编辑子菜单（使用预定义菜单项，它们有默认行为）
    let edit_menu = SubmenuBuilder::new(app, "编辑")
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
      "重新加载",
      true,
      Some("CmdOrCtrl+R"),
    )?;
    
    let fullscreen_item = MenuItem::with_id(
      app,
      "fullscreen",
      fullscreen_text,
      true,
      Some("F11"),
    )?;
    
    let view_menu = SubmenuBuilder::new(app, "视图")
      .item(&reload_item)
      .item(&fullscreen_item)
      .build()?;
  
    // 创建帮助子菜单
    let about_item = MenuItem::with_id(
      app,
      "about",
      "关于",
      true,
      None::<&str>,
    )?;
    
    let help_menu = SubmenuBuilder::new(app, "帮助")
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
          let _ = window.set_fullscreen(!is_fullscreen);
          
          // 重新构建菜单以更新文本
          if let Ok(new_menu) = build_app_menu(app) {
            let _ = app.set_menu(new_menu);
          }
        }
      }
      "about" => {
        // 发送事件到前端，触发对话框显示
        let _ = app.emit("show-about", ());
      }
      _ => {}
    }
  }
  