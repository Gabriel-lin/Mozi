let _counter = 0;

/** Generate a unique, time-sortable identifier with an optional prefix. */
export function generateId(prefix = "wf"): string {
  return `${prefix}_${Date.now().toString(36)}_${(++_counter).toString(36)}`;
}
