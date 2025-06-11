import React, { lazy, Suspense } from 'react';

const DynamicLineChart = lazy(() => import('./cpu/DynamicLineChart'));

function App() {
  return (
    <div className="App">
      <h1>动态折线图</h1>
      <Suspense fallback={<div>Loading...</div>}>
        <DynamicLineChart />
      </Suspense>
    </div>
  );
}

export default App;
