/**
 * Formatting helpers for the workflow module (run details, timing UI, etc.).
 * Keep these pure / framework-agnostic so they can be unit-tested in isolation.
 */

/** Format a unix-ms timestamp as `HH:MM:SS` in the user's local time. */
export function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * Human-readable duration: `<1s` → `"123 ms"`, `<1min` → `"1.23 s"`,
 * otherwise `"1m 23s"`.
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)} s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}

/**
 * Stringify an arbitrary value for display in a `<pre>` block. Strings pass
 * through unchanged; everything else is pretty-printed JSON (falling back to
 * `String(v)` for circular / non-serializable values).
 */
export function formatValue(v: unknown): string {
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}
