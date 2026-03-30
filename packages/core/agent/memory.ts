import type { AgentMemory } from "./types";

interface MemoryEntry {
  role: "system" | "user" | "assistant";
  content: string;
}

export class SimpleMemory implements AgentMemory {
  private entries: MemoryEntry[] = [];
  private maxEntries: number;

  constructor(maxEntries = 200) {
    this.maxEntries = maxEntries;
  }

  add(entry: MemoryEntry): void {
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      const systemEntries = this.entries.filter((e) => e.role === "system");
      const recent = this.entries.filter((e) => e.role !== "system").slice(-this.maxEntries + systemEntries.length);
      this.entries = [...systemEntries, ...recent];
    }
  }

  getAll(): MemoryEntry[] {
    return [...this.entries];
  }

  getLast(n: number): MemoryEntry[] {
    return this.entries.slice(-n);
  }

  clear(): void {
    this.entries = [];
  }

  summary(): string {
    if (this.entries.length === 0) return "(无记录)";
    const last5 = this.entries.slice(-5);
    return last5.map((e) => `[${e.role}] ${e.content.slice(0, 80)}`).join("\n");
  }

  get length(): number {
    return this.entries.length;
  }
}

export class SlidingWindowMemory implements AgentMemory {
  private entries: MemoryEntry[] = [];
  private windowSize: number;
  private systemPrompt: MemoryEntry | null = null;

  constructor(windowSize = 20) {
    this.windowSize = windowSize;
  }

  add(entry: MemoryEntry): void {
    if (entry.role === "system" && !this.systemPrompt) {
      this.systemPrompt = entry;
      return;
    }
    this.entries.push(entry);
    if (this.entries.length > this.windowSize) {
      this.entries = this.entries.slice(-this.windowSize);
    }
  }

  getAll(): MemoryEntry[] {
    const result: MemoryEntry[] = [];
    if (this.systemPrompt) result.push(this.systemPrompt);
    result.push(...this.entries);
    return result;
  }

  clear(): void {
    this.entries = [];
    this.systemPrompt = null;
  }

  summary(): string {
    return `窗口记忆: ${this.entries.length}/${this.windowSize} 条`;
  }
}
