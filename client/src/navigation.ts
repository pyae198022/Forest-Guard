import type { PageKey } from "./types";
import {
  BarChart3,
  Database,
  FileBarChart,
  Gauge,
  Info,
  Sparkles,
  Table2,
  Wand2,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  key: PageKey;
  label: string;
  short: string;
  icon: LucideIcon;
  description: string;
}

export const NAV_ITEMS: NavItem[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    short: "Overview",
    icon: Gauge,
    description: "PJBook KPIs, temporal split and headline model results",
  },
  {
    key: "explorer",
    label: "Dataset Explorer",
    short: "Data",
    icon: Table2,
    description:
      "Chapter 2.1 — the 4,030 x 27 country-year panel (1990-2020), quality report and attribute dictionary",
  },
  {
    key: "preprocessing",
    label: "Data Preprocessing",
    short: "Prepare",
    icon: Wand2,
    description:
      "Chapter 2.2 — quality audit, log1p transform, one-hot encoding, Min-Max scaling and hybrid feature selection",
  },
  {
    key: "visualization",
    label: "Data Visualization",
    short: "Charts",
    icon: BarChart3,
    description:
      "Chapter 2.3 — distributions, outliers, regional spreads, trends and correlation structure",
  },
  {
    key: "mining",
    label: "Descriptive Mining",
    short: "Mining",
    icon: FileBarChart,
    description:
      "Chapter 3.1 — Apriori association rules (support/confidence/lift) and K-Means clustering",
  },
  {
    key: "prediction",
    label: "AI Prediction",
    short: "Predict",
    icon: Sparkles,
    description:
      "Chapter 3.2 — predict Deforestation_Ha and Low/High risk with the trained PJBook models",
  },
  {
    key: "evaluation",
    label: "Model Evaluation",
    short: "Models",
    icon: Database,
    description:
      "Chapter 4 — regression & classification comparisons, ROC-AUC, confusion matrix and 5-fold CV",
  },
  {
    key: "about",
    label: "About Project",
    short: "About",
    icon: Info,
    description:
      "Project book summary — objectives, methodology, findings and limitations",
  },
];
