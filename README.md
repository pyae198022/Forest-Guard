# ForestGuard AI — PJBook Edition 🌲

Interactive, full-stack companion to the **IS-212 Data & Knowledge Mining
project book** *"Deforestation Data with Climate and Habitat"* (Semester IX,
University of Computer Studies, Yangon). Every chapter of the book's
methodology is implemented as a live, reproducible web application.

## Dataset

`Deforestation_Data_With_Climate_And_Habitat.xlsx` — a **4,030 × 27
country-year panel (1990-2020, 130 countries, 7 regions)** with 25 numeric
and 2 categorical attributes. Zero missing values, zero duplicates. Target:
`Deforestation_Ha`. The Excel file is mirrored into a canonical CSV
(`dataset/forestguard_dataset.csv`) and SQLite at boot.

## Methodology (project-book faithful)

| Book chapter | Implementation |
|---|---|
| 2.1 Dataset & statistics | Attribute dictionary (Table 2.1.1), descriptive stats (2.1.2), quality report (2.1.3) |
| 2.2.1 Missing values | Audit only — the panel ships complete |
| 2.2.2 Transformation | `log1p` on the 5 skewed features (skew ≈ 10.6) · one-hot `Entity`/`Region` |
| 2.2.3 Feature selection | Hybrid ranking: Spearman + Mutual Information + RF permutation importance; subset sizes 5/8/10/12/15 validated on a 2012-2015 window; production models pin the book's Table 4.1.1 **Top-13** (regression) / **Top-10** (classification) |
| 2.2.4 Normalisation | Min-Max scaling fit on the training split only |
| 2.3 Visualisation | Distributions + skewness, box plots + IQR outliers, per-region spread, global trend, records-by-region, correlation heat-map, target correlations |
| 3.1.1 Association rules | Hand-rolled Apriori: `pd.qcut` Low/Medium/High bins, target excluded, support ≥ 0.10, confidence ≥ 0.60, lift / leverage / conviction |
| 3.1.2 Clustering | K-Means (random_state 42, n_init 10) over 10 book features, K = 2…10 by inertia + silhouette (optimum K = 2), PCA scatter, profiles, IF-THEN rules |
| 3.2 Modelling | **Strict temporal split: train ≤ 2015, test > 2015** (no shuffling). Leakage filter drops `CO2_Emissions_Mt`, `Lost_Carbon_Sink_kt`, `PM25_Emissions_Tons`, `PM10_Emissions_Tons` (plus EIS from the candidate pool). RF + MLP regressors/classifiers, regression trained on `log1p` target |
| Ch. 4 Evaluation | MAE / RMSE / R² in hectares, Accuracy / Balanced Accuracy / Macro-P/R/F1, ROC-AUC, confusion matrices, 5-fold CV (training split only) |

### Reproduction highlights (live run vs book)

| Metric | This app | Book |
|---|---|---|
| RF classification baseline accuracy / macro-F1 | **0.9846 / 0.9845** | 0.9846 / 0.9845 |
| MLP classifier (Top-10) accuracy | **0.9754** | 0.9754 |
| RF Top-13 regression MAE / R² | 16,572 ha / 0.9717 | 16,269 ha / 0.9747 |
| RF baseline regression MAE / R² | 17,350 ha / 0.9730 | 17,268 ha / 0.9692 |
| ROC-AUC (RF classifier Top-10) | 0.9987 | 0.9988 |
| Frequent itemset `Species_Habitat_Loss_Pct_Low` support | 0.9221 | 0.922 |
| K-Means optimum K / silhouette | 2 / ≈0.24 | 2 / 0.2520 |

The evaluation UI shows **live values side-by-side with the book's reported
numbers** for full transparency.

## Architecture

```
forestguard-ai/
├── client/                  # frontend modules (mounted by the Next.js app)
│   ├── components/          # AppShell, glass cards, stat cards
│   ├── pages/               # the 8 PJBook-aligned pages
│   ├── charts/              # Recharts components (box plot, ROC, heatmap…)
│   ├── services/            # typed FastAPI client
│   ├── hooks/               # useApi fetch hook
│   └── src/                 # navigation, theme, types
├── server/                  # Python FastAPI micro-service (port 3010)
│   ├── app.py               # lifespan: seed -> train -> warm caches
│   ├── routes/              # dataset / preprocessing / visualization /
│   │                        # mining / prediction / evaluation
│   ├── ml/                  # config · preprocessing · associate (Apriori)
│   │                        # cluster (K-Means) · models (RF + MLP + CV)
│   ├── database/            # Excel -> CSV/SQLite seeding, run history
│   ├── models/              # joblib artefacts + state.json
│   └── utils/               # paths, response envelope
├── dataset/                 # uploaded Excel + canonical CSV + info JSON
├── src/app/page.tsx         # Next.js 16 SPA entry (React 19)
└── scripts/start_ml.sh      # resilient backend starter
```

**Stack** — Next.js 16 · React 19 · TypeScript · Tailwind CSS · shadcn/ui ·
Recharts · Framer Motion · Python 3.12 · FastAPI · scikit-learn · pandas ·
NumPy · Joblib · SQLite.

## Pages

1. **Dashboard** — panel KPIs, temporal split, class balance, trend, champions
2. **Dataset Explorer** — quality report, faceted record browser, attribute
   dictionary, column profiles, Table 2.1.2 statistics
3. **Data Preprocessing** — six-step pipeline with live hybrid ranking and
   temporal subset validation (cached server-side, instant reruns)
4. **Data Visualization** — the complete Figure 2.3 set, interactive
5. **Descriptive Mining** — Apriori itemsets / rules / lift scatter + K-Means
   K-selection, PCA scatter, cluster profiles
6. **AI Prediction** — 20-slider scenario console, Low/High-risk presets,
   regression (hectares) and Low/High classification with the trained models
7. **Model Evaluation** — regression & classification leaderboards vs book
   benchmarks, ROC curves, confusion matrices, 5-fold CV, importances, findings
8. **About Project** — book summary, objectives, methodology map, advantages,
   limitations, references

## Running

```bash
python3 -m uvicorn server.app:app --host 0.0.0.0 --port 3010   # backend
bun run dev                                                    # frontend :3000
```

First boot imports the Excel panel, trains the full model suite (~2.5 min
incl. 5-fold CV) and persists joblib artefacts + `state.json`; subsequent
boots restore instantly. In local dev, `next.config.ts` rewrites `/api/*` and
`/health` to :3010; on the sandbox preview domain the gateway's
`?XTransformPort=3010` performs the same routing.

## Deployment

Frontend → **Vercel**, backend → **Render**. The frontend rewrites `/api/*`
and `/health` to the Render service via the `BACKEND_URL` env var (see
`next.config.ts`); the dataset, SQLite mirror and trained joblib artefacts
are committed so the backend boots instantly. See **`DEPLOYMENT.md`** for
the full step-by-step guide (`render.yaml` and `vercel.json` are ready).
