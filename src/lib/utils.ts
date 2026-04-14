import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Extract a concise message from LLM SDK / HTTP error strings.
 *
 * Many provider SDKs embed JSON in their error text, e.g.
 *   Error code: 401 - {'error': {'message': 'Incorrect API key ...', ...}}
 *
 * This helper extracts the `message` value; falls back to the raw string.
 */
export function extractErrorMessage(raw: string): string {
  const match = raw.match(/['"]message['"]\s*:\s*['"](.+?)['"]/);
  return match ? match[1] : raw;
}
