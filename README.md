# ForestGuard AI — Forest Ecosystem Data Mining Platform

A full-stack data-mining application that monitors **4,030 forest plots** across 6 global
ecoregions and classifies their **deforestation risk** (Low / Medium / High) from
**27 environmental, climate, biodiversity and socio-economic features**.

Built as a university Data Mining project covering the complete mining lifecycle:
collection → preprocessing → exploratory analysis → descriptive mining → supervised
modeling → evaluation → deployment.

![stack](https://img.shields.io/badge/React_19-Next.js_16-10b981)
![ml](https://img.shields.io/badge/scikit--learn-FastAPI-84cc16)
![db](https://img.shields.io/badge/SQLite-CSV-teal)

---

## Folder Structure

```
forestguard-ai/
├── client/                     # React frontend modules
│   ├── src/                    #   types, theme tokens, navigation config
│   ├── components/             #   reusable UI (app shell, glass cards, stat cards, badges…)
│   ├── pages/                  #   the 8 page views (one module each)
│   ├── charts/                 #   Recharts wrappers (donut, radar, ROC, heatmap…)
│   ├── hooks/                  #   useApi data-fetching hook
│   ├── services/               #   typed API client (XTransformPort gateway)
│   └── assets/                 #   logo & decorative SVGs
│
├── server/                     # Python FastAPI mini-service (port 3010)
│   ├── app.py                  #   app factory, lifespan bootstrap, health
│   ├── routes/                 #   dataset / preprocessing / visualization / mining / prediction / evaluation
│   ├── ml/                     #   feature config, pipelines, training, evaluation, predictor
│   ├── models/                 #   persisted joblib artifacts + state.json
│   ├── database/               #   SQLite layer (raw table, run history) + seeder
│   └── utils/                  #   config, response envelope, dataset generator
│
├── dataset/                    # forestguard_dataset.csv + dataset_info.json
├── scripts/                    # start_ml.sh (resilient backend starter)
└── README.md
```

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript 5, Next.js 16 (App Router), Tailwind CSS 4, shadcn/ui, Recharts, Framer Motion |
| Backend | Python 3.12, FastAPI, Uvicorn, Pydantic |
| Data / ML | Pandas, NumPy, scikit-learn, Joblib |
| Storage | SQLite (raw + preprocessed tables, run history) and CSV import/export |

## Application Pages

1. **Dashboard** — KPI cards, risk donut, ecoregion stacked bars, vegetation gradient, region radar
2. **Dataset Explorer** — paginated table with search/region/risk filters, per-column profiles, CSV import/export
3. **Data Preprocessing** — quality audit (missing, duplicates, IQR outliers), configurable pipeline, before/after comparison, persisted to SQLite
4. **Data Visualization** — tabbed gallery: histograms, risk scatter, correlation heatmap, composition charts
5. **Descriptive Mining** — full describe() table, skewness panel, region aggregates, top correlations, K-Means + PCA projection with silhouette score
6. **AI Prediction** — 27-feature interactive form (presets, sliders), 5 models, per-class probabilities, sensitivity-based explanations
7. **Model Evaluation** — leaderboard, grouped metric bars, per-class precision/recall, ROC (OvR), feature importance, confusion matrix, one-click retraining (raw or preprocessed)
8. **About Project** — methodology, pipeline diagram, tech stack, learning outcomes

## Dataset

- **4,030 records × 27 features** (synthetic generator with realistic causal structure)
- Feature groups: Geographic (5), Environmental (7), Climate (7), Biodiversity (3), Socio-economic (5)
- Target: `deforestation_risk` — Low 40% / Medium 36% / High 24%
- Injected imperfections for the preprocessing module: ~0.9 % missing cells, 20 duplicate rows, outliers in elevation/rainfall/population
- Regenerate: `python3 -m server.utils.dataset_generator`

## Model Performance (80/20 stratified split, 5-fold CV)

| Model | Accuracy | F1 (macro) | ROC-AUC (OvR) |
|---|---|---|---|
| Logistic Regression | **90.6 %** | 0.904 | 0.983 |
| Gradient Boosting | 89.7 % | 0.897 | 0.978 |
| Random Forest | 86.9 % | 0.868 | 0.969 |
| K-Nearest Neighbors | 82.6 % | 0.821 | 0.948 |
| Decision Tree | 78.9 % | 0.781 | 0.887 |

Each prediction is explained with **finite-difference sensitivity analysis**: the change in
predicted-class probability caused by a small increase in each feature (top-5 shown).

## Running Locally

```bash
# 1. Frontend + backend (ML service auto-starts with the dev server)
bun install
bun run dev            # Next.js on :3000, FastAPI on :3010

# 2. Manual backend start (optional)
bash scripts/start_ml.sh
python3 -m uvicorn server.app:app --port 3010
```

The frontend calls the Python service through the gateway using relative paths with
`?XTransformPort=3010`; no CORS or absolute URLs involved.

## API Overview

```
GET  /health                                  service + model status
GET  /api/dataset/summary                     schema, missing, duplicates, class balance
GET  /api/dataset/records                     pagination + region/risk/search filters
GET  /api/dataset/column-profile/{name}       stats + histogram bins
POST /api/dataset/import                      CSV upload (multipart)
GET  /api/dataset/export                      CSV download
GET  /api/preprocessing/overview              quality audit
POST /api/preprocessing/run                   execute cleaning pipeline
GET  /api/visualization/overview              chart-ready aggregates
GET  /api/visualization/histogram|scatter|correlation
GET  /api/mining/descriptive                  describe() + correlations + outliers
POST /api/mining/clustering                   K-Means + PCA projection
GET  /api/prediction/features|presets         form metadata
POST /api/prediction/predict                  single inference + explanations
GET  /api/evaluation/summary                  per-model metrics
GET  /api/evaluation/roc|confusion-matrix|feature-importance
POST /api/evaluation/retrain                  retrain (raw | preprocessed)
```

## Methodology Notes

- The synthetic generator embeds a latent risk score driven by vegetation health (NDVI),
  human pressure (logging/agriculture), climate stress (drought, fire risk) and protection
  status — so classifiers learn genuine structure rather than noise.
- Preprocessing mirrors training: the sklearn `ColumnTransformer` (impute → scale → one-hot)
  guarantees the same transformations at inference time.
- Class weights are balanced for tree/linear models to counter the moderate class imbalance.
- All metrics are computed on a held-out stratified test set, with 5-fold CV reported as mean ± std.
