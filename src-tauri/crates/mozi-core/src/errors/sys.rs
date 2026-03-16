use thiserror::Error;

/// 系统层错误（操作系统信息获取、配置读写等）
#[derive(Debug, Error, Clone)]
pub enum SysError {
    /// 深色模式偏好读取失败
    #[error("深色模式检测失败: {0}")]
    DarkModeDetectionFailed(String),

    /// sysinfo 系统信息采集失败
    #[error("系统信息获取失败: {0}")]
    SystemInfoFailed(String),

    /// 文件/IO 操作失败
    #[error("IO 错误: {0}")]
    IoError(String),

    /// 配置文件解析或写入失败
    #[error("配置错误: {0}")]
    ConfigError(String),

    /// 环境变量缺失
    #[error("环境变量缺失: {0}")]
    EnvVarMissing(String),

    #[error("未知系统错误: {0}")]
    Unknown(String),
}

impl From<std::io::Error> for SysError {
    fn from(e: std::io::Error) -> Self {
        Self::IoError(e.to_string())
    }
}
