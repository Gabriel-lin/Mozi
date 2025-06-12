import React, { lazy, Suspense, useEffect, useRef, useState } from "react";

const DynamicLineChart = lazy(() => import("./cpu/DynamicLineChart"));
const CpuMonitor = lazy(() => import("./cpu/CpuMonitor"));

function App() {
  return (
    <div
      style={{
        height: "100vh",
        overflowY: "auto",
      }}
    >
      <h1>动态折线图</h1>
      <Suspense fallback={<div>Loading...</div>}>
        <DynamicLineChart />
      </Suspense>

      <CpuMonitor/>

    </div>
  );
}

export default App;
