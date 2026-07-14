#!/usr/bin/env python3
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import statistics
import sys
import time
from urllib.parse import urlencode
import urllib.error
import urllib.request


def request_json(method, url, token=None, payload=None, timeout=15):
    data = None
    headers = {"Accept": "application/json"}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    started = time.perf_counter()
    with urllib.request.urlopen(request, timeout=timeout) as response:
        body = response.read()
    elapsed_ms = (time.perf_counter() - started) * 1000
    return elapsed_ms, json.loads(body.decode("utf-8") or "{}")


def percentile(values, percent):
    if not values:
        return 0
    ordered = sorted(values)
    index = min(len(ordered) - 1, round((percent / 100) * (len(ordered) - 1)))
    return ordered[index]


def summarize(label, timings):
    return {
        "label": label,
        "count": len(timings),
        "min_ms": round(min(timings), 2),
        "avg_ms": round(statistics.mean(timings), 2),
        "p95_ms": round(percentile(timings, 95), 2),
        "max_ms": round(max(timings), 2),
    }


def with_query(path, params):
    clean_params = {key: value for key, value in params.items() if value not in (None, "")}
    if not clean_params:
        return path
    separator = "&" if "?" in path else "?"
    return f"{path}{separator}{urlencode(clean_params)}"


def main():
    parser = argparse.ArgumentParser(description="Small authenticated API load smoke for Zani staging.")
    parser.add_argument("--api-base-url", required=True)
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--iterations", type=int, default=5)
    parser.add_argument("--fail-p95-ms", type=float, default=0, help="Optional p95 threshold for every endpoint.")
    parser.add_argument("--timeout", type=float, default=15, help="Per-request timeout in seconds.")
    parser.add_argument("--business-id", default="", help="Optional business id for scoped endpoints.")
    parser.add_argument("--output-file", default="", help="Optional path to write JSON results.")
    args = parser.parse_args()

    base_url = args.api_base_url.rstrip("/")
    started_at = datetime.now(timezone.utc).isoformat()
    login_ms, token_payload = request_json(
        "POST",
        f"{base_url}/api/auth/token/",
        payload={"email": args.email, "password": args.password},
        timeout=args.timeout,
    )
    token = token_payload.get("access")
    if not token:
        raise SystemExit("Login succeeded but access token is missing.")

    endpoints = [
        ("auth_me", "/api/auth/me/"),
        ("businesses", "/api/businesses/"),
        ("clients", "/api/clients/"),
        ("leads", "/api/leads/"),
        ("deals", "/api/deals/"),
        ("tasks", "/api/tasks/"),
        ("appointments", "/api/appointments/"),
        ("inbox", "/api/bot-conversations/"),
        ("integrations", "/api/business-connectors/"),
        ("usage_summary", "/api/billing/usage-summary/"),
    ]
    if args.business_id:
        endpoints = [(label, with_query(path, {"business": args.business_id})) for label, path in endpoints]

    timings_by_label = {"auth_login": [login_ms]}
    errors = []

    for _ in range(args.iterations):
        for label, path in endpoints:
            try:
                elapsed_ms, _ = request_json("GET", f"{base_url}{path}", token=token, timeout=args.timeout)
                timings_by_label.setdefault(label, []).append(elapsed_ms)
            except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as exc:
                errors.append(f"{label}: {exc}")

    summaries = [summarize(label, timings) for label, timings in timings_by_label.items()]
    finished_at = datetime.now(timezone.utc).isoformat()
    total_requests = sum(item["count"] for item in summaries)
    payload = {
        "api_base_url": base_url,
        "started_at": started_at,
        "finished_at": finished_at,
        "iterations": args.iterations,
        "business_id": args.business_id,
        "total_requests": total_requests,
        "summaries": summaries,
        "errors": errors,
    }
    rendered = json.dumps(payload, indent=2)
    print(rendered)
    if args.output_file:
        Path(args.output_file).write_text(f"{rendered}\n", encoding="utf-8")

    if errors:
        return 1
    if args.fail_p95_ms:
        slow = [item for item in summaries if item["p95_ms"] > args.fail_p95_ms]
        if slow:
            print(f"p95 threshold failed: {slow}", file=sys.stderr)
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
