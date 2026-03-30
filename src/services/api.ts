import { useAuthStore } from "@mozi/store";

// ── Types ──

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public data?: unknown,
  ) {
    super(code);
    this.name = "ApiError";
  }
}

type RequestInterceptor = (config: RequestConfig) => RequestConfig | Promise<RequestConfig>;
type ResponseInterceptor = (
  response: Response,
  config: RequestConfig,
) => Response | Promise<Response>;

interface RequestConfig extends RequestInit {
  url: string;
  params?: Record<string, string | number | boolean | undefined>;
  skipAuth?: boolean;
}

// ── Api Client ──

class ApiClient {
  private baseUrl: string;
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  // ── Interceptor registration ──

  onRequest(interceptor: RequestInterceptor) {
    this.requestInterceptors.push(interceptor);
    return () => {
      this.requestInterceptors = this.requestInterceptors.filter((i) => i !== interceptor);
    };
  }

  onResponse(interceptor: ResponseInterceptor) {
    this.responseInterceptors.push(interceptor);
    return () => {
      this.responseInterceptors = this.responseInterceptors.filter((i) => i !== interceptor);
    };
  }

  // ── Core request ──

  async request<T = unknown>(config: RequestConfig): Promise<T> {
    let cfg = { ...config };

    for (const interceptor of this.requestInterceptors) {
      cfg = await interceptor(cfg);
    }

    const { url, params, skipAuth: _, ...init } = cfg;

    let fullUrl = url.startsWith("http") ? url : `${this.baseUrl}${url}`;

    if (params) {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined) qs.set(k, String(v));
      }
      const qsStr = qs.toString();
      if (qsStr) fullUrl += `?${qsStr}`;
    }

    let response = await fetch(fullUrl, init);

    for (const interceptor of this.responseInterceptors) {
      response = await interceptor(response, cfg);
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new ApiError(
        response.status,
        body.detail || body.message || `http_${response.status}`,
        body,
      );
    }

    const text = await response.text();
    if (!text) return undefined as T;

    try {
      return JSON.parse(text) as T;
    } catch {
      return text as T;
    }
  }

  // ── Convenience methods ──

  get<T = unknown>(url: string, config?: Omit<RequestConfig, "url" | "method">) {
    return this.request<T>({ ...config, url, method: "GET" });
  }

  post<T = unknown>(
    url: string,
    body?: unknown,
    config?: Omit<RequestConfig, "url" | "method" | "body">,
  ) {
    return this.request<T>({
      ...config,
      url,
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  put<T = unknown>(
    url: string,
    body?: unknown,
    config?: Omit<RequestConfig, "url" | "method" | "body">,
  ) {
    return this.request<T>({
      ...config,
      url,
      method: "PUT",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  patch<T = unknown>(
    url: string,
    body?: unknown,
    config?: Omit<RequestConfig, "url" | "method" | "body">,
  ) {
    return this.request<T>({
      ...config,
      url,
      method: "PATCH",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  delete<T = unknown>(url: string, config?: Omit<RequestConfig, "url" | "method">) {
    return this.request<T>({ ...config, url, method: "DELETE" });
  }
}

// ── Singleton instance ──

const BASE_URL = import.meta.env.VITE_API_BASE ?? "/api/v1";

export const api = new ApiClient(BASE_URL);

// ── Request interceptor: inject auth token & default headers ──

api.onRequest((config) => {
  const headers = new Headers(config.headers);

  if (!headers.has("Content-Type") && config.method !== "GET") {
    headers.set("Content-Type", "application/json");
  }

  if (!config.skipAuth) {
    const token = useAuthStore.getState().session?.accessToken;
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  return { ...config, headers };
});

// ── Response interceptor: handle 401 (token expired) ──

api.onResponse((response, _config) => {
  if (response.status === 401) {
    const { isAuthenticated, logout } = useAuthStore.getState();
    if (isAuthenticated) {
      logout();
    }
  }
  return response;
});

export { ApiClient };
