"""Deep validation of the real PJBook dataset vs. claims in the project book."""
import pandas as pd
import numpy as np

SRC = "/home/z/my-project/upload/Deforestation_Data_With_Climate_And_Habitat (1).xlsx"
df = pd.read_excel(SRC)

print("=" * 70)
print("SHAPE:", df.shape)
print("YEARS:", df["Year"].min(), "-", df["Year"].max(), "| unique:", df["Year"].nunique())
print("ENTITIES:", df["Entity"].nunique(), "| REGIONS:", df["Region"].nunique())
print("Region values:", df["Region"].value_counts().to_dict())
print("\nEntity top-8:", df["Entity"].value_counts().head(8).to_dict())
print("Entity bottom-5:", df["Entity"].value_counts().tail(5).to_dict())

print("\n" + "=" * 70)
print("MISSING per column (only >0):")
miss = df.isna().sum()
print(miss[miss > 0].to_string() if miss.sum() else "  -> ZERO missing (matches book Table 2.1.3)")
print("DUPLICATES:", df.duplicated().sum(), "| Entity-Year dupes:", df.duplicated(subset=["Entity", "Year"]).sum())

print("\n" + "=" * 70)
print("SKEWNESS of book-listed skewed features:")
for c in ["Deforestation_Ha", "CO2_Emissions_Mt", "Lost_Carbon_Sink_kt",
          "PM25_Emissions_Tons", "PM10_Emissions_Tons"]:
    if c in df.columns:
        print(f"  {c:28s} skew={df[c].skew():8.2f}  zeros={(df[c]==0).sum()}")

print("\n" + "=" * 70)
print("TIME SPLIT (book: train <=2015, test >2015):")
tr, te = df[df["Year"] <= 2015], df[df["Year"] > 2015]
print(f"  train rows={len(tr)}  test rows={len(te)}")
med = tr["Deforestation_Ha"].median()
print(f"  train median Deforestation_Ha = {med}")
lo_tr, hi_tr = (tr["Deforestation_Ha"] <= med).sum(), (tr["Deforestation_Ha"] > med).sum()
lo_te, hi_te = (te["Deforestation_Ha"] <= med).sum(), (te["Deforestation_Ha"] > med).sum()
print(f"  TRAIN Low={lo_tr} High={hi_tr}   (book: 1690 / 1960)")
print(f"  TEST  Low={lo_te} High={hi_te}   (book:  353 /  297)")

print("\n" + "=" * 70)
print("CANDIDATE POOL check (19 = Year + 18 non-leakage numeric):")
LEAK = ["CO2_Emissions_Mt", "Lost_Carbon_Sink_kt", "PM25_Emissions_Tons",
        "PM10_Emissions_Tons", "Environmental_Impact_Score"]
num_cols = [c for c in df.columns if df[c].dtype != object and c != "Deforestation_Ha"]
cands = ["Year"] + [c for c in num_cols if c not in LEAK and c != "Year"]
print(f"  numeric predictors={len(num_cols)}, leakage={len(LEAK)}, candidates={len(cands)}")
print("  candidates:", cands)

print("\n" + "=" * 70)
print("DESCRIPTIVE STATS sample (book Table 2.1.2 cross-check):")
for c in ["Year", "Deforestation_Ha", "Agricultural_Land_Pct", "Population_Density",
          "GDP_Per_Capita", "Forest_Cover_Pct", "IUCN_Threatened_Species_Count"]:
    s = df[c]
    print(f"  {c:30s} mean={s.mean():12.2f} std={s.std():12.2f} min={s.min():10.2f} med={s.median():10.2f} max={s.max():12.2f}")

print("\n" + "=" * 70)
print("Deforestation by Region (box plot claim: South America highest spread):")
print(df.groupby("Region")["Deforestation_Ha"].agg(["count", "mean", "median", "max", "std"]).round(1).to_string())

print("\nGlobal annual avg trend head/tail (book: declining):")
t = df.groupby("Year")["Deforestation_Ha"].mean()
print(t.head(4).round(0).to_dict(), "...", t.tail(4).round(0).to_dict())

print("\nTop |Spearman| correlations with Deforestation_Ha:")
num = df.select_dtypes("number").drop(columns=["Year"])
sp = num.corr(method="spearman")["Deforestation_Ha"].drop("Deforestation_Ha").abs().sort_values(ascending=False)
print(sp.head(15).round(3).to_string())
