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
    description: "Key numbers, 30-year trend and headline model results",
  },
  {
    key: "explorer",
    label: "Dataset Explorer",
    short: "Data",
    icon: Table2,
    description:
      "Browse, filter and profile the 4,030-record country-year panel (1990-2020)",
  },
  {
    key: "preprocessing",
    label: "Data Preprocessing",
    short: "Prepare",
    icon: Wand2,
    description:
      "Run the six-step pipeline: audit, skew correction, encoding, scaling, feature ranking and validation",
  },
  {
    key: "visualization",
    label: "Data Visualization",
    short: "Charts",
    icon: BarChart3,
    description:
      "Distributions, outliers, regional spreads, trends and correlation structure",
  },
  {
    key: "mining",
    label: "Descriptive Mining",
    short: "Mining",
    icon: FileBarChart,
    description:
      "Association rules and K-Means clustering that reveal hidden patterns",
  },
  {
    key: "prediction",
    label: "AI Prediction",
    short: "Predict",
    icon: Sparkles,
    description:
      "Build a scenario and predict deforestation or Low/High risk with the trained models",
  },
  {
    key: "evaluation",
    label: "Model Evaluation",
    short: "Models",
    icon: Database,
    description:
      "Compare models: metrics, ROC curves, confusion matrix, cross-validation and importance",
  },
  {
    key: "about",
    label: "About Project",
    short: "About",
    icon: Info,
    description:
      "Project background, objectives, methodology, findings and limitations",
  },
];
