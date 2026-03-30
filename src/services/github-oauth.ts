import { fetch } from "@tauri-apps/plugin-http";
import { invoke } from "@tauri-apps/api/core";
import type { GitHubUser } from "@mozi/store";

const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID ?? "";

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

async function parseJSON<T>(res: Response): Promise<T> {
  const text = await res.text();
  return JSON.parse(text) as T;
}

/**
 * Step 1: 向 GitHub 请求 device code，用户需要在浏览器中输入该 code 完成授权。
 */
export async function requestDeviceCode(): Promise<DeviceCodeResponse> {
  const body = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    scope: "user:email read:user",
  });

  const res = await fetch("https://github.com/login/device/code", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error(`GitHub device code request failed: ${res.status}`);
  }

  return parseJSON<DeviceCodeResponse>(res);
}

/**
 * Step 2: 在系统默认浏览器中打开 GitHub 验证页面。
 * 通过 Rust 侧 open_url 命令打开（WSL2 下使用 cmd.exe 桥接到 Windows 浏览器）。
 */
export async function openVerificationPage(url: string): Promise<void> {
  try {
    await invoke("open_url", { url });
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

/**
 * Step 3: 轮询 GitHub 直到用户完成授权或超时。
 * 返回 access_token。
 */
export async function pollForAccessToken(
  deviceCode: string,
  interval: number,
  expiresIn: number,
  signal?: AbortSignal,
): Promise<string> {
  const deadline = Date.now() + expiresIn * 1000;
  let pollInterval = interval || 5;

  const body = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    device_code: deviceCode,
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
  });

  while (Date.now() < deadline) {
    if (signal?.aborted) throw new Error("cancelled");

    await new Promise((r) => setTimeout(r, pollInterval * 1000));

    const res = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    });

    const data = await parseJSON<Record<string, unknown>>(res);

    if (data.access_token) return data.access_token as string;

    if (data.error === "authorization_pending") continue;

    if (data.error === "slow_down") {
      pollInterval = ((data.interval as number) ?? pollInterval) + 1;
      continue;
    }

    throw new Error((data.error_description as string) ?? (data.error as string));
  }

  throw new Error("device_code_expired");
}

/**
 * Step 4: 用 access_token 获取 GitHub 用户信息。
 * 若 /user 接口未返回邮箱（用户设为私密），则通过 /user/emails 获取主邮箱。
 */
export async function fetchGitHubUser(accessToken: string): Promise<GitHubUser> {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/vnd.github+json",
  };

  const res = await fetch("https://api.github.com/user", { headers });

  if (!res.ok) {
    throw new Error(`GitHub user API failed: ${res.status}`);
  }

  const user = await parseJSON<GitHubUser>(res);

  if (!user.email) {
    try {
      const emailRes = await fetch("https://api.github.com/user/emails", {
        headers,
      });
      if (emailRes.ok) {
        const emails = await parseJSON<GitHubEmail[]>(emailRes);
        const primary = emails.find((e) => e.primary && e.verified);
        if (primary) {
          user.email = primary.email;
        }
      }
    } catch {
      // 邮箱获取失败不阻塞登录流程
    }
  }

  return user;
}

interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
  visibility: string | null;
}
