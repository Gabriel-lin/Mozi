import React, { memo, Suspense } from "react";
import { useCpus } from "../hooks/useCpus"; // 假设你有这个钩子

// 单个进程行组件，使用 memo 优化
const ProcessRow = memo(({ process }: { process: any }) => (
  <tr>
    <td>{process.name}</td>
    <td>{process.pid}</td>
    <td>{process.formattedCpuUsage}%</td>
    <td>{process.formattedMemory} MB</td>
  </tr>
));

// 进程列表组件，使用 memo 优化
const ProcessList = memo(({ processes }: { processes: any[] }) => (
  <table style={{ width: "100%", borderCollapse: "collapse" }}>
    <thead>
      <tr>
        <th>进程名</th>
        <th>PID</th>
        <th>CPU 使用率</th>
        <th>内存使用</th>
      </tr>
    </thead>
    <tbody>
      {processes.map((process) => (
        <ProcessRow key={process.pid} process={process} />
      ))}
    </tbody>
  </table>
));

// 主 CpuMonitor 组件，使用 memo 优化
const CpuMonitor: React.FC = memo(() => {
  // CPU 信息钩子
  const { cpuInfo, loading, error } = useCpus();

  console.log("cpuInfo, loading, error", cpuInfo, loading, error);

  if (error) return <div>错误: {error?.message}</div>;

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <div
        style={{
          height: "500px",
          overflowY: "auto",
          position: "relative",
        }}
      >
        <h2>系统监控</h2>
        {cpuInfo && (
          <div>
            <p>CPU 使用率: {cpuInfo.cpu_usage.toFixed(2)}%</p>
            <p>系统负载: {cpuInfo.load_avg.join(", ")}</p>

            <h3>进程列表</h3>
            <ProcessList processes={cpuInfo.processes} />
          </div>
        )}
      </div>
    </Suspense>
  );
});

export default CpuMonitor;
