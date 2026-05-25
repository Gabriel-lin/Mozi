/**
 * Read ~/.Mozi/mcp.json (Cursor-style `mcpServers`) when running inside Tauri.
 * If the file is missing, creates `~/.Mozi/` and a default `{"mcpServers":{}}` file.
 * In a plain browser, returns `unavailable` — the UI should open a file picker or paste flow.
 */

import { isTauri } from "@tauri-apps/api/core";

const defaultMoziMcpObject = (): Record<string, unknown> => ({ mcpServers: {} });

export type ParseMoziMcpConfigResult =
  | { ok: true; normalized: string; data: Record<string, unknown> }
  | { ok: false; error: string };

/**
 * Parse and validate mcp.json-like content. `JSON.parse` errors are returned, not thrown.
 * Root must be a JSON object (not array / primitive).
 */
export function parseMoziMcpConfigText(raw: string): ParseMoziMcpConfigResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: "Content is empty." };
  }
  let v: unknown;
  try {
    v = JSON.parse(trimmed) as unknown;
  } catch (e) {
    const msg =
      e instanceof SyntaxError && e.message
        ? e.message
        : e instanceof Error
          ? e.message
          : String(e);
    return { ok: false, error: msg };
  }
  if (v === null || typeof v !== "object" || Array.isArray(v)) {
    return {
      ok: false,
      error: "Top-level value must be a JSON object { ... }, not an array or primitive.",
    };
  }
  const normalized = `${JSON.stringify(v, null, 2)}\n`;
  return { ok: true, normalized, data: v as Record<string, unknown> };
}

/** Canonical JSON text; throws SyntaxError with the same message as parse failure (for call sites that expect throw). */
export function normalizeMoziMcpJsonText(raw: string): string {
  const r = parseMoziMcpConfigText(raw);
  if (!r.ok) {
    throw new SyntaxError(r.error);
  }
  return r.normalized;
}

export type MoziMcpJsonResult =
  | { ok: true; data: Record<string, unknown>; created?: boolean }
  | { ok: false; reason: "invalid_json" | "unavailable" }
  | { ok: false; reason: "fs_error"; detail: string };

export async function loadLocalMoziMcpJson(): Promise<MoziMcpJsonResult> {
  if (!isTauri()) {
    return { ok: false, reason: "unavailable" };
  }
  try {
    const path = await import("@tauri-apps/api/path");
    const fs = await import("@tauri-apps/plugin-fs");
    const home = await path.homeDir();
    const dirPath = await path.join(home, ".Mozi");
    const filePath = await path.join(dirPath, "mcp.json");
    if (!(await fs.exists(filePath))) {
      const text = `${JSON.stringify(defaultMoziMcpObject(), null, 2)}\n`;
      await fs.mkdir(dirPath, { recursive: true });
      await fs.writeTextFile(filePath, text);
      return { ok: true, data: defaultMoziMcpObject(), created: true };
    }
    const text = await fs.readTextFile(filePath);
    const parsed = parseMoziMcpConfigText(text);
    if (!parsed.ok) {
      return { ok: false, reason: "invalid_json" };
    }
    return { ok: true, data: parsed.data };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, reason: "fs_error", detail: msg.slice(0, 500) };
  }
}

export type LoadMoziMcpFileTextResult =
  | { ok: true; normalizedText: string }
  | { ok: false; reason: "invalid_json" | "fs_error"; detail?: string };

function defaultMoziMcpNormalizedText(): string {
  const r = parseMoziMcpConfigText(JSON.stringify(defaultMoziMcpObject()));
  if (!r.ok) {
    throw new Error("default mcp json invariant");
  }
  return r.normalized;
}

/** Text for the editor: Tauri reads ~/.Mozi/mcp.json (creates default if missing); browser uses a pretty default. */
export async function loadMoziMcpFileTextForEditor(): Promise<LoadMoziMcpFileTextResult> {
  const fallback = defaultMoziMcpNormalizedText();
  if (!isTauri()) {
    return { ok: true, normalizedText: fallback };
  }
  try {
    const path = await import("@tauri-apps/api/path");
    const fs = await import("@tauri-apps/plugin-fs");
    const home = await path.homeDir();
    const dirPath = await path.join(home, ".Mozi");
    const filePath = await path.join(dirPath, "mcp.json");
    if (!(await fs.exists(filePath))) {
      const text = `${JSON.stringify(defaultMoziMcpObject(), null, 2)}\n`;
      await fs.mkdir(dirPath, { recursive: true });
      await fs.writeTextFile(filePath, text);
      return { ok: true, normalizedText: text };
    }
    const raw = await fs.readTextFile(filePath);
    const parsed = parseMoziMcpConfigText(raw);
    if (!parsed.ok) {
      return { ok: false, reason: "invalid_json", detail: parsed.error };
    }
    return { ok: true, normalizedText: parsed.normalized };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, reason: "fs_error", detail: msg.slice(0, 500) };
  }
}

/** Writes ~/.Mozi/mcp.json only when `normalizedNew !== normalizedInitial`. Returns whether a write occurred. */
export async function writeLocalMoziMcpJsonIfChanged(
  normalizedNew: string,
  normalizedInitial: string,
): Promise<boolean> {
  if (!isTauri() || normalizedNew === normalizedInitial) {
    return false;
  }
  const path = await import("@tauri-apps/api/path");
  const fs = await import("@tauri-apps/plugin-fs");
  const home = await path.homeDir();
  const dirPath = await path.join(home, ".Mozi");
  const filePath = await path.join(dirPath, "mcp.json");
  await fs.mkdir(dirPath, { recursive: true });
  await fs.writeTextFile(filePath, normalizedNew);
  return true;
}
