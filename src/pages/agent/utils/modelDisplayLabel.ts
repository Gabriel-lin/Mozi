/**
 * OpenRouter / upstream APIs often repeat the provider in `name` even though the UI already
 * has a provider dropdown — strip those fragments for selects.
 */
const VENDOR_TOKENS = [
  "OpenAI",
  "Anthropic",
  "Google",
  "DeepSeek",
  "Meta",
  "Mistral",
  "OpenRouter",
  "Microsoft",
  "xAI",
  "AWS",
  "Azure",
  "Local",
  "VLLM",
  "Ollama",
  "Perplexity",
  "Cohere",
  "Zhipu",
  "Moonshot",
  "Qwen",
  "Alibaba",
  "ByteDance",
  "Amazon",
  "NVIDIA",
  "IBM",
] as const;

const VENDOR_ALT = VENDOR_TOKENS.map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");

/** Inner text of trailing (...) / （...） is vendor-only or starts with a vendor token. */
function innerMatchesVendor(inner: string): boolean {
  const t = inner.trim();
  if (!t) return false;
  const lower = t.toLowerCase();

  for (const v of VENDOR_TOKENS) {
    const vl = v.toLowerCase();
    if (lower === vl) return true;
    if (lower.startsWith(vl + " ")) return true;
    if (lower.startsWith(vl + "/")) return true;
    if (lower.startsWith(vl + ":")) return true;
  }

  // "Open AI", "Google AI" → compact
  const nospace = t.replace(/\s+/g, "").toLowerCase();
  if (nospace.startsWith("openai")) return true;
  if (nospace.startsWith("googleai") || lower.startsWith("google ")) return true;
  if (nospace.startsWith("metaai") || (lower.startsWith("meta ") && lower.length < 32)) return true;

  return false;
}

function trailingParenVendorSuffix(raw: string): string | null {
  const m = raw.match(/\s*[(（]\s*([^)）]+)[)）]\s*$/);
  if (!m) return null;
  return innerMatchesVendor(m[1]) ? m[0] : null;
}

/** Technical slug without provider noise — last segment of `org/model`. */
function slugFromModelId(id: string): string {
  const s = id.trim();
  if (!s) return s;
  const seg = s.includes("/") ? s.split("/").pop()!.trim() : s;
  return seg || s;
}

/** Heuristic: remaining marketing string still shouts the vendor. */
function stillHasVendorNoise(s: string): boolean {
  const lower = s.toLowerCase();
  return VENDOR_TOKENS.some((v) => {
    const vl = v.toLowerCase();
    const idx = lower.indexOf(vl);
    if (idx < 0) return false;
    const before = idx === 0 ? "" : lower[idx - 1];
    const after = lower[idx + vl.length] ?? "";
    const boundaryOk =
      (before === "" || /[\s\-–—·•/:｜|(（[/]/.test(before)) &&
      (after === "" || /[\s\-–—·•/:｜|)）\]]/.test(after));
    return boundaryOk;
  });
}

export function modelDisplayLabel(name: string, id: string): string {
  let s = (name || "").trim();
  if (!s) return slugFromModelId(id);

  // Strip trailing "(Vendor)" / （Vendor） repeatedly
  let prev = "";
  while (s !== prev) {
    prev = s;
    const suf = trailingParenVendorSuffix(s);
    if (suf) s = s.slice(0, s.length - suf.length).trim();
  }

  // Leading "Vendor:" / "Vendor—" / "Vendor/"
  const leading = new RegExp(`^(${VENDOR_ALT})\\s*[:：／/｜|\\-–—]\\s*`, "iu");
  s = s.replace(leading, "").trim();

  // Leading "Vendor GPT-…" (no colon — common in OpenRouter titles)
  const leadingWord = new RegExp(`^(${VENDOR_ALT})\\s+(?=\\S)`, "iu");
  s = s.replace(leadingWord, "").trim();

  // Trailing "– Vendor" / "· Vendor" / "| Vendor"
  const trailingClause = new RegExp(`\\s*[-–—·•|｜/:：]\\s*(${VENDOR_ALT})\\s*$`, "iu");
  let prev2 = "";
  while (s !== prev2) {
    prev2 = s;
    s = s.replace(trailingClause, "").trim();
  }

  // Leading "vendor/" slug prefix occasionally duplicated in display titles
  s = s.replace(new RegExp(`^(${VENDOR_ALT})/`, "i"), "").trim();

  if (!s) return slugFromModelId(id);

  // Still noisy — fall back to model id slug (same provider is already selected above)
  if (stillHasVendorNoise(s)) {
    const slug = slugFromModelId(id);
    return slug || s;
  }

  return s;
}
