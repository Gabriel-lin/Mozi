import { StorageError, ErrorCode } from "../errors";
import type { HttpRequestConfig } from "./types";

export async function httpRequest<T = unknown>(
  config: HttpRequestConfig,
  path: string,
  options: {
    method?: string;
    body?: unknown;
    params?: Record<string, string>;
  } = {},
): Promise<T> {
  const url = new URL(path, config.baseUrl);
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v);
    }
  }

  const controller = new AbortController();
  const timeoutId = config.timeout
    ? setTimeout(() => controller.abort(), config.timeout)
    : undefined;

  try {
    const response = await fetch(url.toString(), {
      method: options.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...config.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new StorageError("http", `HTTP ${response.status}: ${text}`, {
        code: ErrorCode.STORAGE_CONNECTION,
        metadata: { status: response.status, url: url.toString() },
      });
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof StorageError) throw error;
    throw new StorageError("http", `请求失败: ${(error as Error).message}`, {
      code: ErrorCode.STORAGE_CONNECTION,
      cause: error as Error,
    });
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
