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
    description: "Key metrics and forest health at a glance",
  },
  {
    key: "explorer",
    label: "Dataset Explorer",
    short: "Data",
    icon: Table2,
    description: "Browse, search, filter and profile the 4,030-record dataset",
  },
  {
    key: "preprocessing",
    label: "Data Preprocessing",
    short: "Prepare",
    icon: Wand2,
    description: "Clean missing values, duplicates and outliers",
  },
  {
    key: "visualization",
    label: "Data Visualization",
    short: "Charts",
    icon: BarChart3,
    description: "Interactive charts across environmental and social variables",
  },
  {
    key: "mining",
    label: "Descriptive Mining",
    short: "Mining",
    icon: FileBarChart,
    description: "Statistics, correlations, outliers and K-Means clusters",
  },
  {
    key: "prediction",
    label: "AI Prediction",
    short: "Predict",
    icon: Sparkles,
    description: "Classify deforestation risk with trained models",
  },
  {
    key: "evaluation",
    label: "Model Evaluation",
    short: "Models",
    icon: Database,
    description: "Compare accuracy, ROC curves and feature importance",
  },
  {
    key: "about",
    label: "About Project",
    short: "About",
    icon: Info,
    description: "Methodology, tech stack and project goals",
  },
];
