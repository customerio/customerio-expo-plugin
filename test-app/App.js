import React, { useEffect } from "react";
import DashboardScreen from "./screens/Dashboard";
import { initializeCioSdk } from "./helpers/SdkInit";

export default function App() {
  useEffect(() => {
    initializeCioSdk();
  }, []);

  return <DashboardScreen />;
}
