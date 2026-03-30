import { ErrorCode, ErrorSeverity, type ErrorContext } from "./types";

export interface MoziErrorOptions {
  code?: ErrorCode;
  severity?: ErrorSeverity;
  module?: string;
  operation?: string;
  metadata?: Record<string, unknown>;
  cause?: Error;
}

export class MoziError extends Error {
  readonly code: ErrorCode;
  readonly severity: ErrorSeverity;
  readonly timestamp: number;
  readonly module?: string;
  readonly operation?: string;
  readonly metadata: Record<string, unknown>;

  constructor(message: string, options: MoziErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = this.constructor.name;
    this.code = options.code ?? ErrorCode.UNKNOWN;
    this.severity = options.severity ?? ErrorSeverity.MEDIUM;
    this.timestamp = Date.now();
    this.module = options.module;
    this.operation = options.operation;
    this.metadata = options.metadata ?? {};
  }

  get context(): ErrorContext {
    return {
      timestamp: this.timestamp,
      severity: this.severity,
      code: this.code,
      module: this.module,
      operation: this.operation,
      metadata: this.metadata,
      cause: this.cause as Error | undefined,
      stack: this.stack,
    };
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      severity: this.severity,
      timestamp: this.timestamp,
      module: this.module,
      operation: this.operation,
      metadata: this.metadata,
      stack: this.stack,
    };
  }

  static from(error: unknown, defaults?: MoziErrorOptions): MoziError {
    if (error instanceof MoziError) return error;
    const msg = error instanceof Error ? error.message : String(error);
    const cause = error instanceof Error ? error : undefined;
    return new MoziError(msg, { ...defaults, cause });
  }
}

export class HttpError extends MoziError {
  readonly statusCode: number;
  readonly url?: string;

  constructor(
    statusCode: number,
    message: string,
    options: { url?: string; module?: string; metadata?: Record<string, unknown>; cause?: Error } = {},
  ) {
    const code = statusCode >= 500 ? ErrorCode.HTTP_SERVER : ErrorCode.HTTP_CLIENT;
    super(message, { code, severity: ErrorSeverity.HIGH, ...options });
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.url = options.url;
  }
}

export class ValidationError extends MoziError {
  readonly fields: Record<string, string[]>;

  constructor(fields: Record<string, string[]>, message = "验证失败", options: MoziErrorOptions = {}) {
    super(message, { ...options, code: ErrorCode.VALIDATION, severity: ErrorSeverity.LOW });
    this.name = "ValidationError";
    this.fields = fields;
  }
}

export class StorageError extends MoziError {
  readonly driver: string;

  constructor(driver: string, message: string, options: MoziErrorOptions = {}) {
    super(message, { ...options, code: options.code ?? ErrorCode.STORAGE, module: "storage" });
    this.name = "StorageError";
    this.driver = driver;
  }
}

export class PluginError extends MoziError {
  readonly pluginId: string;

  constructor(pluginId: string, message: string, options: MoziErrorOptions = {}) {
    super(message, { ...options, code: options.code ?? ErrorCode.PLUGIN, module: "plugin" });
    this.name = "PluginError";
    this.pluginId = pluginId;
  }
}

export class WorkflowError extends MoziError {
  readonly workflowId?: string;
  readonly nodeId?: string;

  constructor(
    message: string,
    options: MoziErrorOptions & { workflowId?: string; nodeId?: string } = {},
  ) {
    super(message, { ...options, code: options.code ?? ErrorCode.WORKFLOW, module: "workflow" });
    this.name = "WorkflowError";
    this.workflowId = options.workflowId;
    this.nodeId = options.nodeId;
  }
}

export class AgentError extends MoziError {
  readonly agentId?: string;

  constructor(message: string, options: MoziErrorOptions & { agentId?: string } = {}) {
    super(message, { ...options, code: options.code ?? ErrorCode.AGENT, module: "agent" });
    this.name = "AgentError";
    this.agentId = options.agentId;
  }
}

export class DataError extends MoziError {
  constructor(message: string, options: MoziErrorOptions = {}) {
    super(message, { ...options, code: options.code ?? ErrorCode.DATA, module: "data" });
    this.name = "DataError";
  }
}

export class CliError extends MoziError {
  constructor(message: string, options: MoziErrorOptions = {}) {
    super(message, { ...options, code: options.code ?? ErrorCode.CLI, module: "cli" });
    this.name = "CliError";
  }
}
