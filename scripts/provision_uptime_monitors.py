#!/usr/bin/env python3
"""Provision UptimeRobot monitors + public status page for WorkforceGuard.

Requires a main (read-write) API key from My Settings → API. This script does
not create the UptimeRobot account itself.

    export UPTIMEROBOT_API_KEY=uXXXX-...
    export UPTIMEROBOT_ALERT_EMAIL=workforceguardai@souravamseekar.com
    python scripts/provision_uptime_monitors.py

Prints the public status-page URL. Paste it into
`dashboard/frontend/src/components/landing/site.ts` as STATUS_PAGE_URL.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

API = "https://api.uptimerobot.com/v2"

MONITORS = [
    ("WorkforceGuard frontend", "https://workforceguardai.souravamseekar.com/"),
    ("WorkforceGuard API liveness", "https://api.workforceguardai.souravamseekar.com/health"),
    (
        "WorkforceGuard API dependencies",
        "https://api.workforceguardai.souravamseekar.com/health/detailed",
    ),
]


def post(path: str, payload: dict) -> dict:
    body = urllib.parse.urlencode(payload).encode()
    req = urllib.request.Request(
        f"{API}/{path}",
        data=body,
        method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode()
        raise SystemExit(f"UptimeRobot {path} HTTP {exc.code}: {detail}") from exc


def main() -> int:
    api_key = os.environ.get("UPTIMEROBOT_API_KEY", "").strip()
    if not api_key:
        print("Set UPTIMEROBOT_API_KEY to a Main (read-write) API key.", file=sys.stderr)
        return 2

    alert_email = os.environ.get(
        "UPTIMEROBOT_ALERT_EMAIL", "workforceguardai@souravamseekar.com"
    ).strip()

    contacts = post("getAlertContacts", {"api_key": api_key, "format": "json"})
    if contacts.get("stat") != "ok":
        raise SystemExit(f"getAlertContacts failed: {contacts}")

    contact_ids: list[str] = []
    for contact in contacts.get("alert_contacts") or []:
        if contact.get("value", "").lower() == alert_email.lower():
            contact_ids.append(str(contact["id"]))
    if not contact_ids:
        created = post(
            "newAlertContact",
            {
                "api_key": api_key,
                "format": "json",
                "type": 2,  # email
                "friendly_name": "WorkforceGuard maintainer",
                "value": alert_email,
            },
        )
        if created.get("stat") != "ok":
            raise SystemExit(
                "Could not create alert contact. Add the email in the UptimeRobot "
                f"UI and re-run. Response: {created}"
            )
        contact_ids.append(str(created["alertcontact"]["id"]))

    # threshold_0_0 = notify on down, no extra delay beyond consecutive-check config
    alert_contacts = "-".join(f"{cid}_0_0" for cid in contact_ids)

    existing = post("getMonitors", {"api_key": api_key, "format": "json"})
    existing_urls = {
        (m.get("url") or "").rstrip("/"): m for m in existing.get("monitors") or []
    }

    monitor_ids: list[str] = []
    for name, url in MONITORS:
        key = url.rstrip("/")
        if key in existing_urls or url in existing_urls:
            monitor = existing_urls.get(key) or existing_urls[url]
            print(f"exists  {name}: {url} (id={monitor['id']})")
            monitor_ids.append(str(monitor["id"]))
            continue
        created = post(
            "newMonitor",
            {
                "api_key": api_key,
                "format": "json",
                "friendly_name": name,
                "url": url,
                "type": 1,  # HTTP(s)
                "interval": 300,
                "timeout": 30,
                "alert_contacts": alert_contacts,
            },
        )
        if created.get("stat") != "ok":
            raise SystemExit(f"newMonitor failed for {url}: {created}")
        monitor_id = str(created["monitor"]["id"])
        print(f"created {name}: {url} (id={monitor_id})")
        monitor_ids.append(monitor_id)

    pages = post("getPSPs", {"api_key": api_key, "format": "json"})
    page_url = None
    for page in pages.get("psps") or []:
        if page.get("friendly_name") == "WorkforceGuard status":
            page_url = page.get("standard_url") or page.get("custom_url")
            print(f"exists  status page id={page.get('id')} url={page_url}")
            break
    if page_url is None:
        psp = post(
            "newPSP",
            {
                "api_key": api_key,
                "format": "json",
                "friendly_name": "WorkforceGuard status",
                "monitors": "-".join(monitor_ids),
                "sort": 1,
                "status": 1,
            },
        )
        if psp.get("stat") != "ok":
            raise SystemExit(f"newPSP failed: {psp}")
        page = psp.get("psp") or {}
        page_url = page.get("standard_url") or page.get("custom_url")
        print(f"created status page id={page.get('id')} url={page_url}")

    print()
    print("Public status page URL:")
    print(page_url or "(UptimeRobot did not return standard_url; copy it from the dashboard)")
    print()
    print("Set dashboard/frontend/src/components/landing/site.ts STATUS_PAGE_URL to that URL.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
