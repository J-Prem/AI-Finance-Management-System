"""
Lightweight ML prediction server.

Stdlib-only HTTP server (no FastAPI / Flask / uvicorn) that loads the
artifacts produced by scripts/train_lite.py and serves the subset of
endpoints the Node backend's mlProxyService actually calls.

This is the offline/sandbox-friendly fallback; when sklearn + fastapi
are installed, app.py is the full-featured service. Both expose the same
HTTP contract under /api/v1.

Endpoints:
  GET  /health
  GET  /api/v1/health
  GET  /api/v1/metrics
  POST /api/v1/categorize
  POST /api/v1/detect-anomalies
  POST /api/v1/predict-spending
  POST /api/v1/detect-recurring        (v1 heuristic)
  POST /api/v1/detect-subscriptions    (v1 heuristic)
  POST /api/v1/identify-opportunities  (heuristic savings suggestions)
  POST /api/v1/health-score            (financial health score)
  POST /api/v1/analyze-personality     (rule-based personality)
  POST /api/v1/analyze-patterns        (behavioural patterns)
"""
from __future__ import annotations

import json
import math
import pickle
import re
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from datetime import datetime

BASE = Path(__file__).resolve().parent
MODELS_DIR = BASE / "trained_models"

TOKEN_RE = re.compile(r"[a-zA-Z0-9']+")


def tokenize(text: str) -> list[str]:
    return [t.lower() for t in TOKEN_RE.findall(text or "")]


def _load(name: str):
    path = MODELS_DIR / name
    if not path.exists():
        return None
    try:
        with open(path, "rb") as fh:
            return pickle.load(fh)
    except Exception as e:
        print(f"[ml-lite] failed to load {name}: {e}", file=sys.stderr)
        return None


MODELS = {
    "categorizer": _load("categorizer_lite.pkl"),
    "anomaly": _load("anomaly_detector_lite.pkl"),
    "forecast": _load("forecast_lite.pkl"),
}
METRICS_FILE = MODELS_DIR / "training_metrics.json"
try:
    METRICS = json.loads(METRICS_FILE.read_text()) if METRICS_FILE.exists() else {}
except Exception:
    METRICS = {}

STARTED_AT = time.time()


# -----------------------------------------------------------------------------
# Prediction helpers
# -----------------------------------------------------------------------------
def predict_category(text: str) -> dict:
    m = MODELS["categorizer"]
    if not m:
        return {"category": "Other", "confidence": 0.0, "model": "fallback"}
    tokens = tokenize(text)
    scores = {}
    for c in m["categories"]:
        s = m["log_prior"].get(c, -20.0)
        lik = m["log_lik"][c]
        oov = lik.get("__OOV__", -20.0)
        for tok in tokens:
            s += lik.get(tok, oov)
        scores[c] = s
    max_s = max(scores.values())
    exp_scores = {c: math.exp(s - max_s) for c, s in scores.items()}
    total = sum(exp_scores.values()) or 1.0
    probs = {c: v / total for c, v in exp_scores.items()}
    best = max(probs.items(), key=lambda kv: kv[1])
    # Top-3 for transparency
    top = sorted(probs.items(), key=lambda kv: kv[1], reverse=True)[:3]
    return {
        "category": best[0],
        "confidence": float(best[1]),
        "model": m.get("type", "naive_bayes_v1"),
        "top_k": [{"category": c, "probability": float(p)} for c, p in top],
    }


def detect_anomaly(amount: float, category: str) -> dict:
    m = MODELS["anomaly"]
    if not m:
        return {"is_anomaly": False, "score": 0.0, "reason": "no model loaded"}
    p = m["params"].get(category)
    if not p:
        return {"is_anomaly": False, "score": 0.0, "reason": f"unknown category {category}"}
    if amount is None or amount <= 0:
        return {"is_anomaly": False, "score": 0.0, "reason": "non-positive amount"}
    log_amt = math.log1p(float(amount))
    z = abs(log_amt - p["log_mean"]) / max(p["log_std"], 1e-6)
    is_anom = bool(z >= m["z_threshold"])
    return {
        "is_anomaly": is_anom,
        "score": float(z),
        "z_threshold": float(m["z_threshold"]),
        "category_p95": p["p95_amount"],
        "reason": (
            f"amount {amount:.2f} is {z:.2f} standard deviations from "
            f"category '{category}' log-mean"
        ),
    }


def _stats(values: list) -> dict:
    if not values:
        return {"n": 0, "mean": 0.0, "std": 0.0, "p50": 0.0, "p95": 0.0, "min": 0.0, "max": 0.0}
    vs = sorted(float(v) for v in values)
    n = len(vs)
    mean = sum(vs) / n
    var = sum((v - mean) ** 2 for v in vs) / n
    return {
        "n": n,
        "mean": round(mean, 2),
        "std": round(math.sqrt(var), 2),
        "p50": round(vs[n // 2], 2),
        "p95": round(vs[min(n - 1, int(0.95 * n))], 2),
        "min": round(vs[0], 2),
        "max": round(vs[-1], 2),
    }


def detect_recurring_tx(transactions: list) -> dict:
    """Group by merchant, detect stable (CV<=20%) repeats ≥2 with monthly-ish cadence."""
    by = {}
    for t in transactions or []:
        m = (t.get("merchant") or "").strip().lower()
        if not m or t.get("amount") is None:
            continue
        by.setdefault(m, []).append(t)
    out = []
    for merchant, items in by.items():
        if len(items) < 2:
            continue
        amounts = [abs(float(i.get("amount", 0))) for i in items]
        s = _stats(amounts)
        if s["mean"] <= 0:
            continue
        cv = s["std"] / s["mean"]
        if cv > 0.25:
            continue
        # gaps in days
        dates = sorted([i.get("date") for i in items if i.get("date")])
        gaps = []
        for i in range(1, len(dates)):
            try:
                a = datetime.fromisoformat(str(dates[i - 1]).replace("Z", ""))
                b = datetime.fromisoformat(str(dates[i]).replace("Z", ""))
                gaps.append((b - a).total_seconds() / 86400.0)
            except Exception:
                pass
        med = sorted(gaps)[len(gaps) // 2] if gaps else 0
        freq = None
        if 25 <= med <= 35:
            freq = "monthly"
        elif 6 <= med <= 8:
            freq = "weekly"
        elif 12 <= med <= 16:
            freq = "biweekly"
        elif 85 <= med <= 95:
            freq = "quarterly"
        elif med >= 360:
            freq = "yearly"
        out.append({
            "merchant": items[0].get("merchant"),
            "amount": s["mean"],
            "count": s["n"],
            "coefficient_of_variation": round(cv, 3),
            "median_gap_days": round(med, 1) if med else None,
            "frequency": freq,
            "confidence": round(max(0.0, 1.0 - cv), 3),
        })
    out.sort(key=lambda r: (r["count"], -r["coefficient_of_variation"]), reverse=True)
    return {"recurring": out, "total_checked": len(transactions or []), "model": "lite_recurring_v1"}


def detect_subscriptions(transactions: list) -> dict:
    """Subset of recurring detection: monthly-cadence entertainment/utility keywords."""
    rec = detect_recurring_tx(transactions)["recurring"]
    keyword_hits = ("netflix", "spotify", "prime", "hbo", "disney", "youtube",
                    "icloud", "dropbox", "adobe", "office", "gym", "club")
    subs = [
        r for r in rec
        if r["frequency"] in ("monthly", "yearly")
        and (any(k in (r["merchant"] or "").lower() for k in keyword_hits) or r["amount"] < 100)
    ]
    return {"subscriptions": subs, "total_detected": len(subs), "model": "lite_subs_v1"}


def identify_opportunities(transactions: list) -> dict:
    """Heuristic savings: dining > 15% of spend, overlap subs, high-variance categories."""
    by_cat = {}
    total = 0.0
    for t in transactions or []:
        amt = abs(float(t.get("amount", 0) or 0))
        cat = t.get("category") or "Other"
        by_cat[cat] = by_cat.get(cat, 0.0) + amt
        total += amt
    opps = []
    if total > 0:
        dining = by_cat.get("Food & Dining", 0.0)
        if dining / total > 0.15:
            opps.append({
                "title": "Trim dining by 20%",
                "category": "Food & Dining",
                "estimated_monthly_saving": round(dining * 0.2, 2),
                "rationale": f"Dining is {dining / total * 100:.0f}% of spend; bringing it to industry average (~12%) saves ~20%.",
            })
        entertainment = by_cat.get("Entertainment", 0.0)
        if entertainment / total > 0.08:
            opps.append({
                "title": "Audit entertainment subscriptions",
                "category": "Entertainment",
                "estimated_monthly_saving": round(entertainment * 0.25, 2),
                "rationale": "Entertainment spend is above the 8% guideline — cancel unused streaming / gaming subs.",
            })
    subs = detect_subscriptions(transactions)["subscriptions"]
    if len(subs) >= 3:
        cheapest = min(s["amount"] for s in subs) if subs else 0
        opps.append({
            "title": f"Consolidate {len(subs)} subscriptions",
            "estimated_monthly_saving": round(sum(s["amount"] for s in subs) * 0.2, 2),
            "rationale": "Bundle or cancel overlapping services; average user drops 2 of 5 subs after review.",
        })
    return {"opportunities": opps, "total_estimated_saving": round(sum(o["estimated_monthly_saving"] for o in opps), 2)}


def financial_health_score(transactions: list, income: float = 0.0) -> dict:
    """0–100 score using savings rate, debt signals, recurring burden, volatility."""
    expense = sum(abs(float(t.get("amount", 0))) for t in transactions or [] if t.get("type") == "expense")
    # Approximate income from 'income' type if not provided.
    if income <= 0:
        income = sum(abs(float(t.get("amount", 0))) for t in transactions or [] if t.get("type") == "income")
    score = 50
    factors = []
    if income > 0:
        savings_rate = max(0.0, (income - expense) / income)
        score += int(30 * min(1.0, savings_rate / 0.2))  # full points at 20% savings rate
        factors.append({"factor": "savings_rate", "value": round(savings_rate, 3)})
    subs = detect_subscriptions(transactions)["subscriptions"]
    sub_burden = sum(s["amount"] for s in subs)
    if income > 0 and sub_burden / income > 0.15:
        score -= 10
        factors.append({"factor": "subscription_overload", "value": round(sub_burden / income, 3)})
    # Volatility — CV of weekly expense
    weekly = {}
    for t in transactions or []:
        try:
            d = datetime.fromisoformat(str(t.get("date", "")).replace("Z", ""))
            week = f"{d.isocalendar().year}-{d.isocalendar().week}"
            weekly[week] = weekly.get(week, 0.0) + abs(float(t.get("amount", 0)))
        except Exception:
            pass
    if weekly:
        vs = list(weekly.values())
        s = _stats(vs)
        cv = (s["std"] / s["mean"]) if s["mean"] > 0 else 0
        if cv > 0.5:
            score -= 10
        factors.append({"factor": "weekly_spend_cv", "value": round(cv, 3)})
    score = max(0, min(100, score))
    grade = "A" if score >= 85 else "B" if score >= 70 else "C" if score >= 55 else "D" if score >= 40 else "F"
    recs = []
    if score < 70:
        recs.append("Automate transferring 15-20% of each paycheck to savings.")
    if any(f["factor"] == "subscription_overload" for f in factors):
        recs.append("Cancel at least one overlapping subscription this month.")
    if any(f["factor"] == "weekly_spend_cv" and f["value"] > 0.5 for f in factors):
        recs.append("Set a weekly cap for discretionary spending to smooth volatility.")
    return {"score": score, "grade": grade, "factors": factors, "recommendations": recs, "model": "lite_health_v1"}


def analyze_personality(transactions: list) -> dict:
    """Rule-based spending personality derived from category mix."""
    by_cat = {}
    total = 0.0
    for t in transactions or []:
        amt = abs(float(t.get("amount", 0) or 0))
        cat = t.get("category") or "Other"
        by_cat[cat] = by_cat.get(cat, 0.0) + amt
        total += amt
    shares = {c: (v / total if total else 0.0) for c, v in by_cat.items()}
    scores = {
        "Saver":    1.0 - min(1.0, total / max(1.0, total + 1)),
        "Foodie":   shares.get("Food & Dining", 0) * 2,
        "Explorer": shares.get("Travel", 0) * 2.5,
        "Socialite": shares.get("Entertainment", 0) * 2,
        "Homebody":  shares.get("Home", 0) * 2 + shares.get("Bills & Utilities", 0),
        "Shopper":  shares.get("Shopping", 0) * 2,
    }
    label = max(scores.items(), key=lambda kv: kv[1])[0] if scores else "Balanced"
    ranked = sorted(({"label": k, "score": round(v, 3)} for k, v in scores.items()), key=lambda r: r["score"], reverse=True)
    narrative = {
        "Foodie":    "You spend generously on food — prioritise cooking 2 dinners/week at home to cut 15-20%.",
        "Explorer":  "Travel dominates your budget — ring-fence travel savings so it doesn't crowd out essentials.",
        "Socialite": "Entertainment drives your month — set a monthly cap and track against it.",
        "Homebody":  "Home/utilities is your #1 bucket — audit energy and subscription bills quarterly.",
        "Shopper":   "Retail therapy is a pattern — use a 48-hour cooling-off rule on non-essentials.",
        "Saver":     "You spend modestly — redirect the surplus into an index fund for long-term growth.",
    }.get(label, "Your spending is balanced — continue tracking and compare against peer benchmarks.")
    return {"label": label, "scores": scores, "ranked": ranked, "narrative": narrative, "model": "lite_personality_v1"}


def analyze_patterns(transactions: list) -> dict:
    """Surface simple behavioural patterns: day-of-week, evening vs morning, merchant concentration."""
    by_dow = [0.0] * 7
    by_hour = [0.0] * 24
    by_merchant = {}
    for t in transactions or []:
        try:
            d = datetime.fromisoformat(str(t.get("date", "")).replace("Z", ""))
            by_dow[d.weekday()] += abs(float(t.get("amount", 0)))
            by_hour[d.hour] += abs(float(t.get("amount", 0)))
            m = (t.get("merchant") or "Unknown").strip()
            by_merchant[m] = by_merchant.get(m, 0.0) + abs(float(t.get("amount", 0)))
        except Exception:
            pass
    top_merchants = sorted(by_merchant.items(), key=lambda kv: kv[1], reverse=True)[:5]
    peak_day = by_dow.index(max(by_dow)) if any(by_dow) else None
    peak_hour = by_hour.index(max(by_hour)) if any(by_hour) else None
    dow_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    patterns = []
    if peak_day is not None:
        patterns.append({"type": "peak_day", "day": dow_names[peak_day], "amount": round(by_dow[peak_day], 2)})
    if peak_hour is not None:
        patterns.append({"type": "peak_hour", "hour": peak_hour, "amount": round(by_hour[peak_hour], 2)})
    if top_merchants:
        patterns.append({"type": "top_merchants", "merchants": [{"merchant": m, "amount": round(v, 2)} for m, v in top_merchants]})
    return {"patterns": patterns, "by_day_of_week": [round(v, 2) for v in by_dow], "model": "lite_patterns_v1"}


def forecast_spending(months: int = 3) -> dict:
    m = MODELS["forecast"]
    if not m:
        return {"forecast": [], "model": "fallback"}
    by_cat = {}
    totals = [0.0] * months
    for cat, p in m["params"].items():
        out = []
        for step in range(1, months + 1):
            idx = p["last_month_idx"] + step
            trend = p["intercept"] + p["slope"] * idx
            month_num = ((datetime.utcnow().month - 1 + step) % 12)
            seasonal = p["month_seasonal"][month_num]
            est = max(0.0, trend + seasonal)
            out.append({"step": step, "estimated_amount": round(est, 2)})
            totals[step - 1] += est
        by_cat[cat] = out
    return {
        "horizon_months": months,
        "total_forecast": [{"step": i + 1, "estimated_amount": round(v, 2)} for i, v in enumerate(totals)],
        "by_category": by_cat,
        "model": m.get("type", "linear_seasonal_v1"),
    }


# -----------------------------------------------------------------------------
# HTTP request handler
# -----------------------------------------------------------------------------
class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        # Silence default access log; print concise line instead
        sys.stdout.write(f"[ml-lite] {self.command} {self.path} - {args[1] if len(args) > 1 else ''}\n")
        sys.stdout.flush()

    def _read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0") or 0)
        if length <= 0:
            return {}
        raw = self.rfile.read(length)
        try:
            return json.loads(raw.decode("utf-8"))
        except Exception:
            return {}

    def _send_json(self, status: int, body: dict) -> None:
        data = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    # GET
    def do_GET(self):
        if self.path in ("/health", "/api/v1/health"):
            loaded = {k: bool(v) for k, v in MODELS.items()}
            self._send_json(200, {
                "status": "ok" if all(loaded.values()) else "degraded",
                "uptime_s": round(time.time() - STARTED_AT, 1),
                "models_loaded": loaded,
                "metrics_summary": {
                    "n_samples": METRICS.get("n_samples"),
                    "categorizer_accuracy": METRICS.get("categorizer", {}).get("accuracy"),
                    "anomaly_f1": METRICS.get("anomaly_detector", {}).get("f1"),
                    "forecast_avg_mae": METRICS.get("forecast", {}).get("avg_mae"),
                },
            })
            return
        if self.path == "/api/v1/metrics":
            self._send_json(200, METRICS)
            return
        self._send_json(404, {"error": "not found", "path": self.path})

    # POST
    def do_POST(self):
        body = self._read_json()
        if self.path == "/api/v1/categorize":
            text = f"{body.get('description', '')} {body.get('merchant', '')}".strip()
            if not text:
                self._send_json(400, {"error": "description or merchant required"})
                return
            result = predict_category(text)
            self._send_json(200, result)
            return

        if self.path == "/api/v1/detect-anomalies":
            transactions = body.get("transactions", [])
            anomalies = []
            for t in transactions:
                r = detect_anomaly(t.get("amount"), t.get("category", "Other"))
                if r["is_anomaly"]:
                    anomalies.append({
                        "transaction": t,
                        **r,
                    })
            self._send_json(200, {
                "anomalies": anomalies,
                "total_checked": len(transactions),
                "model": "category_zscore_v1",
            })
            return

        if self.path == "/api/v1/predict-spending":
            months = int(body.get("months", 3) or 3)
            months = max(1, min(months, 12))
            self._send_json(200, forecast_spending(months))
            return

        # Rich heuristic endpoints — work without any trained models, so the
        # lite server can stand in for the full FastAPI service in restricted
        # environments (Docker layer without sklearn, CI sandboxes, etc).
        if self.path == "/api/v1/detect-recurring":
            self._send_json(200, detect_recurring_tx(body.get("transactions", [])))
            return
        if self.path == "/api/v1/detect-subscriptions":
            self._send_json(200, detect_subscriptions(body.get("transactions", [])))
            return
        if self.path == "/api/v1/identify-opportunities":
            self._send_json(200, identify_opportunities(body.get("transactions", [])))
            return
        if self.path == "/api/v1/health-score":
            self._send_json(200, financial_health_score(
                body.get("transactions", []), float(body.get("income", 0) or 0)
            ))
            return
        if self.path == "/api/v1/analyze-personality":
            self._send_json(200, analyze_personality(body.get("transactions", [])))
            return
        if self.path == "/api/v1/analyze-patterns":
            self._send_json(200, analyze_patterns(body.get("transactions", [])))
            return

        self._send_json(404, {"error": "not found", "path": self.path})


def main() -> int:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    loaded = [k for k, v in MODELS.items() if v]
    missing = [k for k, v in MODELS.items() if not v]
    print(f"[ml-lite] loaded: {loaded}  missing: {missing}")
    print(f"[ml-lite] metrics: n={METRICS.get('n_samples')} "
          f"acc={METRICS.get('categorizer', {}).get('accuracy')} "
          f"anom_f1={METRICS.get('anomaly_detector', {}).get('f1')}")
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"[ml-lite] listening on http://127.0.0.1:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
