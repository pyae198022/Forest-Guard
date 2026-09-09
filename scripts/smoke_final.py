"""Final end-to-end smoke test for the rebuilt (PJBook) ForestGuard AI backend."""
import json
import urllib.request
import urllib.error

BASE = "http://localhost:3010"
PASS, FAIL = [], []


def call(name, method, path, payload=None):
    url = BASE + path
    body = None
    headers = {}
    if payload is not None:
        body = json.dumps(payload).encode()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            data = json.loads(r.read().decode())
            ok = data.get("success") is True
            (PASS if ok else FAIL).append((name, r.status, str(data)[:120]))
            print(("PASS" if ok else "BAD "), f"{name} [{r.status}]", str(data)[:110])
    except urllib.error.HTTPError as e:
        FAIL.append((name, e.code, e.reason))
        print("FAIL", f"{name} [{e.code}]", e.reason)
    except Exception as e:
        FAIL.append((name, 0, str(e)))
        print("FAIL", name, str(e)[:110])


# ---------- dataset ----------
call("dataset/summary", "GET", "/api/dataset/summary")
call("dataset/info", "GET", "/api/dataset/info")
call("dataset/records", "GET", "/api/dataset/records?limit=5")
call("dataset/column-profile", "GET", "/api/dataset/column-profile/Deforestation_Ha")
call("dataset/attributes", "GET", "/api/dataset/attributes")
call("dataset/stats", "GET", "/api/dataset/stats?column=Deforestation_Ha")
call("dataset/facets", "GET", "/api/dataset/facets")

# ---------- preprocessing ----------
call("preproc/overview", "GET", "/api/preprocessing/overview")
call("preproc/run", "POST", "/api/preprocessing/run", {})

# ---------- visualization ----------
call("viz/trend", "GET", "/api/visualization/trend?entity=Brazil")
call("viz/histogram", "GET", "/api/visualization/histogram?feature=Deforestation_Ha")
call("viz/boxplot", "GET", "/api/visualization/boxplot?feature=Deforestation_Ha")
call("viz/region-boxplot", "GET", "/api/visualization/region-boxplot?feature=Deforestation_Ha")
call("viz/records-by-region", "GET", "/api/visualization/records-by-region")
call("viz/correlation", "GET", "/api/visualization/correlation")
call("viz/target-correlation", "GET", "/api/visualization/target-correlation")

# ---------- mining ----------
call("mining/association-overview", "GET", "/api/mining/association/overview")
call("mining/association-itemsets", "GET", "/api/mining/association/itemsets")
call("mining/association-scatter", "GET", "/api/mining/association/scatter")
call("mining/association-rules", "GET", "/api/mining/association/rules")
call("mining/clustering", "POST", "/api/mining/clustering", {"k": 3})

# ---------- prediction ----------
call("pred/models", "GET", "/api/prediction/models")
call("pred/features", "GET", "/api/prediction/features")
call("pred/presets", "GET", "/api/prediction/presets")
call("pred/predict-reg", "POST", "/api/prediction/predict",
     {"model": "rf_top13", "features": {"Year": 2018, "Agricultural_Land_Pct": 45.2}})
call("pred/predict-clf", "POST", "/api/prediction/predict",
     {"model": "rf_clf_top10", "features": {"Year": 2018, "Agricultural_Land_Pct": 45.2}})
call("pred/batch", "POST", "/api/prediction/predict-batch",
     {"model": "rf_clf_top10", "rows": [{"Year": 2018}, {"Year": 2005}]})

# ---------- evaluation ----------
call("eval/summary", "GET", "/api/evaluation/summary")
call("eval/confusion", "GET", "/api/evaluation/confusion-matrix?model=rf_clf_top10")
call("eval/roc", "GET", "/api/evaluation/roc?model=rf_clf_top10")
call("eval/importance", "GET", "/api/evaluation/feature-importance?model=rf_top13")
call("eval/regression-comparison", "GET", "/api/evaluation/regression-comparison")
call("eval/classification-comparison", "GET", "/api/evaluation/classification-comparison")
call("eval/cross-validation", "GET", "/api/evaluation/cross-validation")
call("eval/feature-sets", "GET", "/api/evaluation/feature-sets")

print("\n========== RESULT ==========")
print(f"PASS: {len(PASS)}   FAIL: {len(FAIL)}")
for f in FAIL:
    print("  FAILED:", f)
