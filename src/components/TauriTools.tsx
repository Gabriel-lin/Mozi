import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useTauriDialog } from "@/components/TauriDialog";
import {
  open,
  save,
} from "@tauri-apps/plugin-dialog";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { writeText, readText } from "@tauri-apps/plugin-clipboard-manager";
import { open as shellOpen } from "@tauri-apps/plugin-shell";
import { platform } from "@tauri-apps/plugin-os";
import { exit, relaunch } from "@tauri-apps/plugin-process";

interface ToolItem {
  name: string;
  description: string;
  action: () => Promise<void>;
}

export function TauriTools() {
  const [logs, setLogs] = useState<string[]>([]);
  const [platformInfo, setPlatformInfo] = useState<string>("");
  const { message, confirm, ask, DialogComponent } = useTauriDialog();

  const addLog = (log: string) => {
    setLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${log}`, ...prev.slice(0, 9)]);
  };

  const tools: ToolItem[] = [
    {
      name: "消息弹窗",
      description: "显示系统消息弹窗",
      action: async () => {
        await message("这是一条来自 Tauri 的消息!", {
          title: "提示",
          kind: "info",
        });
        addLog("消息弹窗已显示");
      },
    },
    {
      name: "确认弹窗",
      description: "显示确认对话框",
      action: async () => {
        const result = await confirm("确定要执行此操作吗?", {
          title: "确认",
          kind: "warning",
        });
        addLog(`用户选择: ${result ? "确认" : "取消"}`);
      },
    },
    {
      name: "询问弹窗",
      description: "显示询问对话框",
      action: async () => {
        const result = await ask("你想要继续吗?", {
          title: "询问",
          kind: "info",
        });
        addLog(`用户选择: ${result ? "是" : "否"}`);
      },
    },
    {
      name: "打开文件",
      description: "打开文件选择器",
      action: async () => {
        const selected = await open({
          multiple: false,
          filters: [
            {
              name: "图片",
              extensions: ["png", "jpg", "jpeg", "gif", "webp"],
            },
            {
              name: "所有文件",
              extensions: ["*"],
            },
          ],
        });
        if (selected) {
          addLog(`已选择文件: ${selected}`);
        } else {
          addLog("用户取消了文件选择");
        }
      },
    },
    {
      name: "保存文件",
      description: "打开文件保存对话框",
      action: async () => {
        const filePath = await save({
          filters: [
            {
              name: "文本文件",
              extensions: ["txt", "md"],
            },
          ],
          defaultPath: "untitled.txt",
        });
        if (filePath) {
          addLog(`保存路径: ${filePath}`);
        } else {
          addLog("用户取消了保存");
        }
      },
    },
    {
      name: "系统通知",
      description: "发送系统通知",
      action: async () => {
        let permissionGranted = await isPermissionGranted();
        if (!permissionGranted) {
          const permission = await requestPermission();
          permissionGranted = permission === "granted";
        }
        if (permissionGranted) {
          sendNotification({
            title: "Mozi 通知",
            body: "这是一条系统通知!",
          });
          addLog("系统通知已发送");
        } else {
          addLog("通知权限被拒绝");
        }
      },
    },
    {
      name: "复制到剪贴板",
      description: "复制文本到剪贴板",
      action: async () => {
        await writeText("Hello from Tauri!");
        addLog("已复制 'Hello from Tauri!' 到剪贴板");
      },
    },
    {
      name: "读取剪贴板",
      description: "读取剪贴板内容",
      action: async () => {
        const text = await readText();
        addLog(`剪贴板内容: ${text || "(空)"}`);
      },
    },
    {
      name: "打开外部链接",
      description: "在浏览器中打开链接",
      action: async () => {
        await shellOpen("https://github.com");
        addLog("已在浏览器中打开 GitHub");
      },
    },
    {
      name: "获取平台信息",
      description: "获取当前操作系统平台",
      action: async () => {
        const os = await platform();
        setPlatformInfo(os);
        addLog(`当前平台: ${os}`);
      },
    },
    {
      name: "退出应用",
      description: "退出当前应用程序",
      action: async () => {
        const confirmed = await confirm("确定要退出应用吗?", {
          title: "退出确认",
          kind: "warning",
        });
        if (confirmed) {
          await exit(0);
        }
      },
    },
    {
      name: "重启应用",
      description: "重新启动应用程序",
      action: async () => {
        const confirmed = await confirm("确定要重启应用吗?", {
          title: "重启确认",
          kind: "warning",
        });
        if (confirmed) {
          await relaunch();
        }
      },
    },
  ];

  return (
    <>
      <DialogComponent />
      <div className="p-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          {tools.map((tool) => (
            <Button
              key={tool.name}
              variant="outline"
              onClick={tool.action}
              className="flex flex-col items-start h-auto py-2 px-3"
            >
              <span className="font-medium">{tool.name}</span>
              <span className="text-xs text-muted-foreground">
                {tool.description}
              </span>
            </Button>
          ))}
        </div>

        {platformInfo && (
          <div className="text-sm text-muted-foreground">
            当前平台: <span className="font-medium">{platformInfo}</span>
          </div>
        )}

        {logs.length > 0 && (
          <div className="bg-muted p-3 rounded-md">
            <h4 className="text-sm font-medium mb-2">操作日志:</h4>
            <div className="space-y-1">
              {logs.map((log, index) => (
                <p key={index} className="text-xs text-muted-foreground">
                  {log}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
