// 将工具错误的具体定义委托给顶层 errors 模块，
// 此处保留 re-export 以维持各工具子模块内的 import 路径不变。
pub use crate::errors::tool::ToolError;
