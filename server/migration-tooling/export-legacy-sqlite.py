#!/usr/bin/env python3
"""Read-only legacy SQLite inventory/export. Password columns are never selected."""
import argparse
import json
import os
import sqlite3
from datetime import datetime, timezone

SAFE_QUERIES = {
    "auth_users": "SELECT id, email FROM auth_users ORDER BY id",
    "users": "SELECT * FROM users ORDER BY id",
    "weight_entries": "SELECT * FROM weight_entries ORDER BY user_id, date, id",
    "catalog_items": "SELECT * FROM catalog_items ORDER BY id",
}

def rows(connection, sql):
    return [dict(row) for row in connection.execute(sql)]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--database", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    database = os.path.abspath(args.database)
    output = os.path.abspath(args.output)
    if os.path.exists(output):
        raise SystemExit("Output already exists; refusing to overwrite it.")
    uri = f"file:{database.replace(os.sep, '/')}?mode=ro&immutable=1"
    connection = sqlite3.connect(uri, uri=True)
    connection.row_factory = sqlite3.Row
    try:
        available = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        data = {name: rows(connection, sql) for name, sql in SAFE_QUERIES.items() if name in available}
    finally:
        connection.close()
    payload = {
        "formatVersion": 1,
        "kind": "legacy-sqlite-manual-review",
        "exportedAt": datetime.now(timezone.utc).isoformat(),
        "sourcePathBasename": os.path.basename(database),
        "tables": data,
        "warning": "Legacy numeric profile enums and identity ownership require manual mapping. No password field is included.",
    }
    descriptor = os.open(output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
        handle.write("\n")
    print("Read-only legacy export complete: " + ", ".join(f"{name}={len(value)}" for name, value in data.items()))

if __name__ == "__main__":
    main()
