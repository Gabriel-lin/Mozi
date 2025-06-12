import { useState, useEffect, useCallback, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';

// 定义深度比较函数
function isDeepEqual(obj1: any, obj2: any): boolean {
  if (obj1 === obj2) return true;
  
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object' || obj1 === null || obj2 === null) {
    return false;
  }

  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) return false;

  for (const key of keys1) {
    if (!keys2.includes(key)) return false;
    
    if (Array.isArray(obj1[key]) && Array.isArray(obj2[key])) {
      if (obj1[key].length !== obj2[key].length) return false;
      
      for (let i = 0; i < obj1[key].length; i++) {
        if (!isDeepEqual(obj1[key][i], obj2[key][i])) return false;
      }
    } else if (typeof obj1[key] === 'object' && typeof obj2[key] === 'object') {
      if (!isDeepEqual(obj1[key], obj2[key])) return false;
    } else if (obj1[key] !== obj2[key]) {
      return false;
    }
  }

  return true;
}

interface SystemInfo {
    cpu_usage: number;
    load_avg: [number, number, number];
    processes: {
      pid: number;
      name: string;
      cpu_usage: number;
      memory: number;
    }[];
}

export const useCpus = () => {
    const [cpuInfo, setCpuInfo] = useState<SystemInfo | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<Error | null>(null);

    const fetchSystemInfo = useCallback(async () => {
        try {
            setLoading(true);
            const systemInfo = await invoke('get_system_info') as SystemInfo;
            
            // 使用深度比较，只在数据实际变化时更新
            setCpuInfo(prevInfo => {
                if (!prevInfo || !isDeepEqual(prevInfo, systemInfo)) {
                    return systemInfo;
                }
                return prevInfo;
            });
            
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('获取系统信息失败'));
        } finally {
            setLoading(false);
        }
    }, []);

    // 使用 useMemo 缓存处理后的数据
    const processedCpuInfo = useMemo(() => {
        if (!cpuInfo) return null;

        return {
            ...cpuInfo,
            processes: cpuInfo.processes.map(process => ({
                ...process,
                formattedCpuUsage: process.cpu_usage.toFixed(2),
                formattedMemory: (process.memory / 1024 / 1024).toFixed(2)
            }))
        };
    }, [cpuInfo]);

    useEffect(() => {
        fetchSystemInfo();
        const intervalId = setInterval(fetchSystemInfo, 100);
        return () => clearInterval(intervalId);
    }, [fetchSystemInfo]);

    return {
        cpuInfo: processedCpuInfo,
        loading,
        error,
        refetch: fetchSystemInfo
    };
};
