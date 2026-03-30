export enum ErrorCode {
  // 通用 0xxx
  UNKNOWN = "E0000",
  VALIDATION = "E0001",
  NOT_FOUND = "E0002",
  PERMISSION_DENIED = "E0003",
  TIMEOUT = "E0004",
  CANCELLED = "E0005",
  RATE_LIMITED = "E0006",
  CONFLICT = "E0007",

  // 网络 1xxx
  NETWORK = "E1000",
  HTTP_CLIENT = "E1001",
  HTTP_SERVER = "E1002",
  CONNECTION_REFUSED = "E1003",
  DNS_FAILURE = "E1004",

  // 存储 2xxx
  STORAGE = "E2000",
  STORAGE_CONNECTION = "E2001",
  STORAGE_QUERY = "E2002",
  STORAGE_TRANSACTION = "E2003",
  STORAGE_MIGRATION = "E2004",
  STORAGE_NOT_FOUND = "E2005",

  // 插件 3xxx
  PLUGIN = "E3000",
  PLUGIN_NOT_FOUND = "E3001",
  PLUGIN_LOAD_FAILED = "E3002",
  PLUGIN_DEPENDENCY = "E3003",
  PLUGIN_CONFLICT = "E3004",
  PLUGIN_LIFECYCLE = "E3005",

  // 工作流 4xxx
  WORKFLOW = "E4000",
  WORKFLOW_NODE_FAILED = "E4001",
  WORKFLOW_CYCLE = "E4002",
  WORKFLOW_INVALID_GRAPH = "E4003",
  WORKFLOW_TIMEOUT = "E4004",

  // 智能体 5xxx
  AGENT = "E5000",
  AGENT_NOT_FOUND = "E5001",
  AGENT_STEP_LIMIT = "E5002",
  AGENT_TOOL_FAILED = "E5003",
  AGENT_ALREADY_RUNNING = "E5004",

  // 数据 6xxx
  DATA = "E6000",
  DATA_SCHEMA = "E6001",
  DATA_TRANSFORM = "E6002",
  DATA_SOURCE = "E6003",

  // CLI 7xxx
  CLI = "E7000",
  CLI_PARSE = "E7001",
  CLI_COMMAND_NOT_FOUND = "E7002",
  CLI_ARG_INVALID = "E7003",
}

export enum ErrorSeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

export interface ErrorContext {
  timestamp: number;
  severity: ErrorSeverity;
  code: ErrorCode;
  module?: string;
  operation?: string;
  metadata?: Record<string, unknown>;
  cause?: Error;
  stack?: string;
}

export interface ErrorHandler {
  (error: AppError, context: ErrorContext): void;
}

export type AppError = import("./base").MoziError;
