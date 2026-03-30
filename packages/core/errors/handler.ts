import { MoziError, type MoziErrorOptions } from "./base";
import { ErrorSeverity, type ErrorHandler, type ErrorContext } from "./types";

type Unsubscribe = () => void;

class GlobalErrorHandler {
  private handlers: Set<ErrorHandler> = new Set();
  private recentErrors: Array<{ error: MoziError; context: ErrorContext }> = [];
  private maxHistory = 100;

  subscribe(handler: ErrorHandler): Unsubscribe {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  capture(error: unknown, defaults?: MoziErrorOptions): MoziError {
    const moziError = MoziError.from(error, defaults);
    const context = moziError.context;

    this.recentErrors.push({ error: moziError, context });
    if (this.recentErrors.length > this.maxHistory) {
      this.recentErrors.shift();
    }

    for (const handler of this.handlers) {
      try {
        handler(moziError, context);
      } catch {
        // handler 自身出错不应中断
      }
    }

    return moziError;
  }

  get history(): ReadonlyArray<{ error: MoziError; context: ErrorContext }> {
    return this.recentErrors;
  }

  filterBySeverity(severity: ErrorSeverity) {
    return this.recentErrors.filter((e) => e.context.severity === severity);
  }

  filterByModule(module: string) {
    return this.recentErrors.filter((e) => e.context.module === module);
  }

  clear(): void {
    this.recentErrors = [];
  }
}

export const errorHandler = new GlobalErrorHandler();

export function tryCatch<T>(fn: () => T, defaults?: MoziErrorOptions): T {
  try {
    return fn();
  } catch (error) {
    throw errorHandler.capture(error, defaults);
  }
}

export async function tryCatchAsync<T>(
  fn: () => Promise<T>,
  defaults?: MoziErrorOptions,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw errorHandler.capture(error, defaults);
  }
}
