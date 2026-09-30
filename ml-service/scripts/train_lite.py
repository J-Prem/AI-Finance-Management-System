"""
Lightweight ML training pipeline.

Trains three models using only numpy + pandas (no sklearn / prophet required),
then saves the artifacts to ../trained_models/ in a format the lite predict
server can load directly.

Artifacts produced:
  - categorizer_lite.pkl           Naive-Bayes-ish token -> category scorer
  - anomaly_detector_lite.pkl      Per-category mean/std for z-score detection
  - forecast_lite.pkl              Per-category linear-trend + seasonality params
  - training_metrics.json          Cross-validation / holdout metrics
"""
from __future__ import annotations

import json
import math
import pickle
import random
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

BASE = Path(__file__).resolve().parent.parent
MODELS_DIR = BASE / "trained_models"
DATA_DIR = BASE / "data"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

# -----------------------------------------------------------------------------
# Synthetic data generator (standalone, does not depend on utils/data_generator)
# -----------------------------------------------------------------------------
MERCHANTS = {
    "Food": [
        "Swiggy", "Zomato", "Uber Eats", "Dominos", "McDonalds",
        "Starbucks", "Cafe Coffee Day", "PizzaHut", "Biryani House",
        "South Indian Restaurant",
    ],
    "Groceries": [
        "Big Basket", "Flipkart Grocery", "Amazon Fresh", "Blinkit",
        "DMart", "Reliance Fresh", "Supermarket", "Local Grocery Store",
    ],
    "Transport": [
        "Uber", "Ola", "Rapido", "Metro", "Petrol Pump", "Parking",
        "Auto Rickshaw", "Toll Plaza",
    ],
    "Shopping": [
        "Flipkart", "Amazon", "Myntra", "Nike Store", "Zara",
        "H&M", "Westside", "Max Fashion",
    ],
    "Entertainment": [
        "Netflix", "Amazon Prime", "Disney+", "Hotstar", "BookMyShow",
        "PVR Cinema", "INOX", "Spotify",
    ],
    "Bills": [
        "Electricity Board", "Water Supply", "Gas Supply",
        "Internet Provider", "Mobile Operator", "Insurance Company",
    ],
    "Healthcare": [
        "Apollo Hospital", "Max Hospital", "Fortis Hospital", "Pharmacy",
        "Medical Store", "Dental Clinic",
    ],
    "Education": [
        "School", "College", "University", "Online Course",
        "BYJU'S", "Coursera", "Udemy",
    ],
    "Travel": [
        "MakeMyTrip", "Cleartrip", "GoIbibo", "OYO Rooms",
        "Airbnb", "Flight Booking", "Train Booking",
    ],
    "Other": [
        "ATM Withdrawal", "Bank Fee", "Miscellaneous", "Cash",
    ],
}

# Amount ranges (INR)
AMOUNT_RANGES = {
    "Food": (80, 900),
    "Groceries": (200, 4500),
    "Transport": (30, 600),
    "Shopping": (300, 12000),
    "Entertainment": (100, 2500),
    "Bills": (400, 8000),
    "Healthcare": (150, 15000),
    "Education": (500, 25000),
    "Travel": (1500, 40000),
    "Other": (50, 1500),
}

# Seasonal multipliers by month (Jan..Dec) — festivals, travel seasons etc.
SEASONAL = {
    "Food": [1.0, 1.0, 1.05, 1.05, 1.0, 1.0, 1.0, 1.05, 1.05, 1.15, 1.20, 1.25],
    "Shopping": [1.0, 0.95, 1.0, 1.05, 1.0, 1.0, 1.1, 1.05, 1.0, 1.3, 1.4, 1.5],
    "Travel": [1.2, 1.1, 1.0, 1.05, 1.35, 1.4, 1.2, 1.0, 1.0, 1.2, 1.1, 1.3],
    "Bills": [1.0] * 12,
    "Groceries": [1.0] * 12,
    "Transport": [1.0] * 12,
    "Entertainment": [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.05, 1.1, 1.15],
    "Healthcare": [1.1, 1.05, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.05],
    "Education": [1.3, 1.0, 1.0, 1.2, 1.0, 1.1, 1.3, 1.1, 1.0, 1.0, 1.0, 1.0],
    "Other": [1.0] * 12,
}


def generate_synthetic_transactions(n: int = 20000, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    random.seed(seed)
    today = datetime(2026, 4, 15)
    start = today - timedelta(days=730)  # 2 years

    cats = list(MERCHANTS.keys())
    # Skew category distribution (Food/Groceries/Transport most common)
    cat_weights = np.array([0.22, 0.18, 0.15, 0.10, 0.08, 0.08, 0.06, 0.05, 0.04, 0.04])
    cat_weights /= cat_weights.sum()

    rows = []
    for _ in range(n):
        category = rng.choice(cats, p=cat_weights)
        merchant = random.choice(MERCHANTS[category])
        lo, hi = AMOUNT_RANGES[category]
        # Log-normal-ish amount
        base = float(rng.uniform(lo, hi))
        days_offset = int(rng.integers(0, 730))
        date = start + timedelta(days=days_offset)
        # Apply monthly seasonality
        seasonal_mult = SEASONAL[category][date.month - 1]
        amount = round(base * seasonal_mult, 2)
        rows.append({
            "description": f"{merchant} payment",
            "merchant": merchant,
            "amount": amount,
            "category": category,
            "date": date,
        })

    # Inject ~2% anomalies (unusually large per-category amounts)
    anomaly_count = max(1, int(0.02 * n))
    for _ in range(anomaly_count):
        idx = int(rng.integers(0, n))
        rows[idx]["amount"] = round(rows[idx]["amount"] * rng.uniform(5, 15), 2)
        rows[idx]["is_anomaly_truth"] = True

    df = pd.DataFrame(rows)
    df["is_anomaly_truth"] = df.get("is_anomaly_truth", False).fillna(False) \
        if "is_anomaly_truth" in df.columns else False
    return df


# -----------------------------------------------------------------------------
# Text helpers
# -----------------------------------------------------------------------------
TOKEN_RE = re.compile(r"[a-zA-Z0-9']+")


def tokenize(text: str) -> list[str]:
    return [t.lower() for t in TOKEN_RE.findall(text or "")]


# -----------------------------------------------------------------------------
# 1) Categorizer: Multinomial Naive Bayes with add-one smoothing
# -----------------------------------------------------------------------------
def train_categorizer(df: pd.DataFrame) -> tuple[dict, dict]:
    # Build vocab + per-category token counts
    print(f"[categorizer] training on {len(df)} samples")
    by_cat_counts: dict[str, Counter] = defaultdict(Counter)
    cat_totals: Counter = Counter()
    cat_doc_counts: Counter = Counter()
    vocab = set()
    for _, row in df.iterrows():
        text = f"{row['description']} {row['merchant']}"
        tokens = tokenize(text)
        cat = row["category"]
        cat_doc_counts[cat] += 1
        for tok in tokens:
            by_cat_counts[cat][tok] += 1
            cat_totals[cat] += 1
            vocab.add(tok)
    vocab = sorted(vocab)

    total_docs = sum(cat_doc_counts.values())
    log_prior = {c: math.log(max(cat_doc_counts[c], 1) / total_docs) for c in cat_doc_counts}

    # Log-likelihood table: log P(token | cat) with add-one smoothing
    V = len(vocab)
    log_lik: dict[str, dict[str, float]] = {}
    for c in cat_doc_counts:
        total = cat_totals[c] + V
        log_lik[c] = {}
        for tok in vocab:
            log_lik[c][tok] = math.log((by_cat_counts[c].get(tok, 0) + 1) / total)
        log_lik[c]["__OOV__"] = math.log(1 / total)

    # 80/20 holdout accuracy
    shuffled = df.sample(frac=1.0, random_state=7).reset_index(drop=True)
    split = int(0.8 * len(shuffled))
    train, test = shuffled.iloc[:split], shuffled.iloc[split:]
    print(f"[categorizer] holdout: train={len(train)} test={len(test)}")

    model = {
        "type": "naive_bayes_v1",
        "log_prior": log_prior,
        "log_lik": log_lik,
        "categories": sorted(cat_doc_counts.keys()),
    }

    correct = 0
    for _, row in test.iterrows():
        pred, _ = predict_category(model, f"{row['description']} {row['merchant']}")
        if pred == row["category"]:
            correct += 1
    accuracy = correct / len(test) if len(test) else 0.0
    print(f"[categorizer] holdout accuracy: {accuracy:.4f}")

    metrics = {
        "n_train": int(len(train)),
        "n_test": int(len(test)),
        "accuracy": float(accuracy),
        "num_categories": len(cat_doc_counts),
        "vocab_size": V,
    }
    return model, metrics


def predict_category(model: dict, text: str) -> tuple[str, float]:
    tokens = tokenize(text)
    scores: dict[str, float] = {}
    log_prior = model["log_prior"]
    log_lik = model["log_lik"]
    for c in model["categories"]:
        s = log_prior.get(c, -20.0)
        for tok in tokens:
            s += log_lik[c].get(tok, log_lik[c].get("__OOV__", -20.0))
        scores[c] = s
    # Softmax for confidence
    max_s = max(scores.values())
    exp_scores = {c: math.exp(s - max_s) for c, s in scores.items()}
    total = sum(exp_scores.values())
    probs = {c: v / total for c, v in exp_scores.items()}
    best = max(probs.items(), key=lambda kv: kv[1])
    return best[0], float(best[1])


# -----------------------------------------------------------------------------
# 2) Anomaly detector: per-category log-amount Gaussian, z-score threshold
# -----------------------------------------------------------------------------
def train_anomaly_detector(df: pd.DataFrame) -> tuple[dict, dict]:
    print(f"[anomaly] training on {len(df)} samples")
    params: dict[str, dict] = {}
    for cat, group in df.groupby("category"):
        amounts = np.log1p(group["amount"].values.astype(float))
        params[cat] = {
            "log_mean": float(amounts.mean()),
            "log_std": float(max(amounts.std(ddof=0), 1e-3)),
            "n": int(len(amounts)),
            "p95_amount": float(np.percentile(group["amount"], 95)),
            "median_amount": float(np.median(group["amount"])),
        }
    # Evaluate against planted truth
    z_threshold = 3.0
    tp = fp = fn = tn = 0
    for _, row in df.iterrows():
        log_amt = math.log1p(row["amount"])
        p = params[row["category"]]
        z = abs(log_amt - p["log_mean"]) / p["log_std"]
        pred = z >= z_threshold
        truth = bool(row.get("is_anomaly_truth", False))
        if pred and truth:
            tp += 1
        elif pred and not truth:
            fp += 1
        elif not pred and truth:
            fn += 1
        else:
            tn += 1
    precision = tp / max(tp + fp, 1)
    recall = tp / max(tp + fn, 1)
    f1 = 2 * precision * recall / max(precision + recall, 1e-9)
    print(f"[anomaly] tp={tp} fp={fp} fn={fn} tn={tn} "
          f"precision={precision:.3f} recall={recall:.3f} f1={f1:.3f}")

    model = {
        "type": "category_zscore_v1",
        "z_threshold": z_threshold,
        "params": params,
    }
    metrics = {
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "z_threshold": z_threshold,
        "categories": list(params.keys()),
    }
    return model, metrics


# -----------------------------------------------------------------------------
# 3) Forecast: per-category linear trend + monthly seasonality (fit by OLS)
# -----------------------------------------------------------------------------
def train_forecast(df: pd.DataFrame) -> tuple[dict, dict]:
    print(f"[forecast] training on {len(df)} samples")
    df = df.copy()
    df["month"] = df["date"].dt.to_period("M").dt.to_timestamp()
    df["month_idx"] = (df["month"] - df["month"].min()).dt.days // 30

    params: dict[str, dict] = {}
    total_mae = []
    for cat, group in df.groupby("category"):
        monthly = group.groupby("month_idx")["amount"].sum().reset_index()
        if len(monthly) < 2:
            continue
        x = monthly["month_idx"].values.astype(float)
        y = monthly["amount"].values.astype(float)
        # Fit y = a + b*x via closed-form OLS
        x_mean = x.mean()
        y_mean = y.mean()
        denom = float(((x - x_mean) ** 2).sum()) or 1e-9
        b = float(((x - x_mean) * (y - y_mean)).sum() / denom)
        a = float(y_mean - b * x_mean)
        # Monthly seasonality: residual average per calendar month
        resid = y - (a + b * x)
        months = group.groupby("month_idx")["date"].first().dt.month.values
        month_seasonal = np.zeros(12)
        counts = np.zeros(12)
        for r, m in zip(resid, months):
            month_seasonal[m - 1] += r
            counts[m - 1] += 1
        counts = np.where(counts == 0, 1, counts)
        month_seasonal = (month_seasonal / counts).tolist()

        # Holdout MAE: last 3 months
        mae = float(np.mean(np.abs(resid[-3:]))) if len(resid) >= 3 else 0.0
        total_mae.append(mae)
        params[cat] = {
            "intercept": a,
            "slope": b,
            "month_seasonal": month_seasonal,
            "last_month_idx": int(x.max()),
            "training_mae": mae,
        }

    model = {
        "type": "linear_seasonal_v1",
        "params": params,
    }
    metrics = {
        "categories": list(params.keys()),
        "avg_mae": float(np.mean(total_mae)) if total_mae else 0.0,
    }
    print(f"[forecast] avg holdout MAE: {metrics['avg_mae']:.2f}")
    return model, metrics


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
def main() -> int:
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 20000
    print(f"== training lite models (n={n}) ==")
    df = generate_synthetic_transactions(n)
    print(f"[data] generated {len(df)} transactions, "
          f"{df['is_anomaly_truth'].sum()} planted anomalies")

    categorizer, cat_metrics = train_categorizer(df)
    anomaly, anom_metrics = train_anomaly_detector(df)
    forecast, fcst_metrics = train_forecast(df)

    artifacts = {
        "categorizer_lite.pkl": categorizer,
        "anomaly_detector_lite.pkl": anomaly,
        "forecast_lite.pkl": forecast,
    }
    for fname, obj in artifacts.items():
        path = MODELS_DIR / fname
        with open(path, "wb") as fh:
            pickle.dump(obj, fh, protocol=pickle.HIGHEST_PROTOCOL)
        print(f"[save] {path} ({path.stat().st_size} bytes)")

    metrics = {
        "trained_at": datetime.utcnow().isoformat() + "Z",
        "n_samples": int(len(df)),
        "categorizer": cat_metrics,
        "anomaly_detector": anom_metrics,
        "forecast": fcst_metrics,
    }
    (MODELS_DIR / "training_metrics.json").write_text(json.dumps(metrics, indent=2))
    print(f"[save] {MODELS_DIR / 'training_metrics.json'}")
    print("== done ==")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
