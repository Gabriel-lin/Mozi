import React, { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Maximize2, Minimize2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function TitleBar() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const init = async () => {
      try {
        const win = getCurrentWindow();
        const current = await win.isFullscreen();
        setIsFullscreen(current);

        unlisten = await win.onResized(async () => {
          const fs = await win.isFullscreen();
          setIsFullscreen(fs);
        });
      } catch {
        // 非 Tauri 环境忽略
      }
    };

    init();
    return () => unlisten?.();
  }, []);

  const handleMinimize = async () => {
    try {
      await getCurrentWindow().minimize();
    } catch {}
  };

  const handleFullscreen = async () => {
    try {
      const win = getCurrentWindow();
      const fs = await win.isFullscreen();
      await win.setFullscreen(!fs);
      setIsFullscreen(!fs);
    } catch {}
  };

  const handleClose = async () => {
    try {
      await getCurrentWindow().close();
    } catch {}
  };

  return (
    <div
      data-tauri-drag-region
      className="flex h-9 w-full shrink-0 items-center select-none border-b border-border/50 bg-background/80 backdrop-blur-sm"
    >
      {/* 拖拽区域占满剩余空间 */}
      <div data-tauri-drag-region className="flex-1 h-full" />

      {/* 窗口控制按钮 */}
      <div className="flex items-center h-full">
        <button
          onClick={handleMinimize}
          className={cn(
            "flex h-9 w-10 items-center justify-center",
            "text-foreground/60 transition-colors duration-150",
            "hover:bg-muted hover:text-foreground",
          )}
          title="最小化"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={handleFullscreen}
          className={cn(
            "flex h-9 w-10 items-center justify-center",
            "text-foreground/60 transition-colors duration-150",
            "hover:bg-muted hover:text-foreground",
          )}
          title={isFullscreen ? "退出全屏" : "全屏"}
        >
          {isFullscreen ? (
            <Minimize2 className="h-3.5 w-3.5" />
          ) : (
            <Maximize2 className="h-3.5 w-3.5" />
          )}
        </button>

        <button
          onClick={handleClose}
          className={cn(
            "flex h-9 w-10 items-center justify-center",
            "text-foreground/60 transition-colors duration-150",
            "hover:bg-destructive hover:text-destructive-foreground",
          )}
          title="关闭"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
