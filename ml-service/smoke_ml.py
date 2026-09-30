"""
ML lite server smoke test.

Boots ml_lite_server in-process on a random port, then hits every endpoint
the Node backend actually calls and asserts shape + rough correctness.
"""
from __future__ import annotations

import json
import socket
import sys
import threading
import time
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from ml_lite_server import Handler, MODELS, METRICS  # noqa: E402


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def call(method: str, url: str, body: dict | None = None) -> tuple[int, dict]:
    data = None
    headers = {"Content-Type": "application/json"}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Length"] = str(len(data))
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
            return resp.status, payload
    except urllib.error.HTTPError as e:
        try:
            payload = json.loads(e.read().decode("utf-8"))
        except Exception:
            payload = {}
        return e.code, payload


passed = 0
failed = 0


def check(label: str, ok: bool, extra: str = "") -> None:
    global passed, failed
    if ok:
        passed += 1
        print(f"  [PASS] {label}" + (f" - {extra}" if extra else ""))
    else:
        failed += 1
        print(f"  [FAIL] {label}" + (f" - {extra}" if extra else ""))


def main() -> int:
    port = free_port()
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{port}"
    time.sleep(0.2)

    print("== ML lite server smoke ==\n")

    # 0) Artifacts loaded
    check("categorizer artifact loaded", MODELS["categorizer"] is not None,
          f"type={MODELS['categorizer'] and MODELS['categorizer'].get('type')}")
    check("anomaly artifact loaded", MODELS["anomaly"] is not None)
    check("forecast artifact loaded", MODELS["forecast"] is not None)
    check("training metrics present", bool(METRICS),
          f"n_samples={METRICS.get('n_samples')}")

    # 1) /health
    status, body = call("GET", f"{base}/health")
    check("GET /health returns 200", status == 200, f"status={status}")
    check("/health reports all models loaded",
          body.get("status") == "ok" and all(body.get("models_loaded", {}).values()),
          f"body={body}")

    # 2) categorize — a clearly-Food description
    status, body = call("POST", f"{base}/api/v1/categorize",
                        {"description": "Swiggy order", "merchant": "Swiggy"})
    check("POST /categorize returns 200", status == 200, f"status={status}")
    check("categorize picks Food for 'Swiggy'",
          body.get("category") == "Food" and body.get("confidence", 0) > 0.5,
          f"category={body.get('category')} conf={body.get('confidence')}")

    # 3) categorize — a clearly-Transport description
    status, body = call("POST", f"{base}/api/v1/categorize",
                        {"description": "Uber ride", "merchant": "Uber"})
    check("categorize picks Transport for 'Uber'",
          body.get("category") == "Transport",
          f"category={body.get('category')}")

    # 4) categorize empty body
    status, body = call("POST", f"{base}/api/v1/categorize", {})
    check("categorize rejects empty body with 400", status == 400, f"status={status}")

    # 5) detect-anomalies — one normal and one huge
    status, body = call("POST", f"{base}/api/v1/detect-anomalies", {
        "transactions": [
            {"amount": 300, "category": "Food"},
            {"amount": 500000, "category": "Food"},
            {"amount": 100000, "category": "Groceries"},
        ]
    })
    check("POST /detect-anomalies returns 200", status == 200, f"status={status}")
    anomalies = body.get("anomalies", [])
    check("detect-anomalies flags at least one outlier",
          len(anomalies) >= 1,
          f"found={len(anomalies)}/{body.get('total_checked')}")
    check("detect-anomalies does NOT flag 300 INR food",
          not any(a["transaction"]["amount"] == 300 for a in anomalies),
          f"normal-food flagged={any(a['transaction']['amount'] == 300 for a in anomalies)}")

    # 6) predict-spending
    status, body = call("POST", f"{base}/api/v1/predict-spending", {"months": 3})
    check("POST /predict-spending returns 200", status == 200, f"status={status}")
    total_forecast = body.get("total_forecast", [])
    check("predict-spending returns 3 horizon steps", len(total_forecast) == 3,
          f"len={len(total_forecast)}")
    check("predict-spending per-category present",
          isinstance(body.get("by_category"), dict) and len(body["by_category"]) >= 3,
          f"categories={list((body.get('by_category') or {}).keys())[:3]}")
    check("predict-spending totals > 0",
          all(p["estimated_amount"] > 0 for p in total_forecast),
          f"totals={[p['estimated_amount'] for p in total_forecast]}")

    # 7) unknown route
    status, _ = call("GET", f"{base}/nope")
    check("unknown route returns 404", status == 404, f"status={status}")

    print(f"\nResult: {passed} passed, {failed} failed")
    server.shutdown()
    server.server_close()
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
