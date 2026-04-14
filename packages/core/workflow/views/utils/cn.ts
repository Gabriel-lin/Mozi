/** Lightweight class-name joiner — no tailwind-merge needed in core. */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
