"use client";

import { useState } from "react";
import { AppShell } from "@client/components/app-shell";
import {
  AboutPage,
  DashboardPage,
  DatasetExplorerPage,
  DescriptiveMiningPage,
  ModelEvaluationPage,
  PredictionPage,
  PreprocessingPage,
  VisualizationPage,
} from "@client/pages";
import type { PageKey } from "@client/src/types";

/**
 * ForestGuard AI — single-page application shell.
 * Navigation switches page views client-side; all data comes from the
 * Python FastAPI mini-service on :3010 (via the gateway proxy).
 */
export default function Home() {
  const [active, setActive] = useState<PageKey>("dashboard");

  return (
    <AppShell active={active} onNavigate={setActive}>
      {active === "dashboard" && <DashboardPage />}
      {active === "explorer" && <DatasetExplorerPage />}
      {active === "preprocessing" && <PreprocessingPage />}
      {active === "visualization" && <VisualizationPage />}
      {active === "mining" && <DescriptiveMiningPage />}
      {active === "prediction" && <PredictionPage />}
      {active === "evaluation" && <ModelEvaluationPage />}
      {active === "about" && <AboutPage />}
    </AppShell>
  );
}
