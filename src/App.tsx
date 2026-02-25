import React, { lazy, useEffect, useState } from "react";
import { Calendar } from "./components/ui/calendar";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalHeader,
  ModalTitle,
} from "./components/ui/modal";
import { listen } from "@tauri-apps/api/event";

const DynamicLineChart = lazy(() => import("./cpu/DynamicLineChart"));
const CpuMonitor = lazy(() => import("./cpu/CpuMonitor"));

function App() {
  const [aboutOpen, setAboutOpen] = useState(false);

  useEffect(() => {
    let unlistenFn: (() => void) | null = null;

    const setupEventListener = async () => {
      try {
        unlistenFn = await listen<void>("show-about", () => {
          setAboutOpen(true);
        });
      } catch {
        // 非 Tauri 环境（如浏览器预览），忽略
      }
    };

    setupEventListener();

    return () => {
      unlistenFn?.();
    };
  }, []);

  return (
    <div className="h-screen overflow-y-auto w-full">
      {/* <h1 className="text-red-500 text-2xl font-bold">动态折线图</h1> */}
      {/* <Suspense fallback={<div>Loading...</div>}>
        <DynamicLineChart />
      </Suspense> */}

      {/* <CpuMonitor/> */}

      <Calendar
        className="w-[50%] mx-auto h-fit"
        mode="single"
        selected={new Date()}
        captionLayout="dropdown"
      />

      {/* 关于模态框 */}
      <Modal open={aboutOpen} onOpenChange={setAboutOpen}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>关于 Mozi</ModalTitle>
            <ModalDescription>
              <div className="space-y-2 mt-4">
                <p className="text-base font-medium">版本: 0.1.0</p>
                <p className="text-sm text-muted-foreground">
                  一个基于 Tauri 的应用
                </p>
              </div>
            </ModalDescription>
          </ModalHeader>
        </ModalContent>
      </Modal>
    </div>
  );
}

export default App;
