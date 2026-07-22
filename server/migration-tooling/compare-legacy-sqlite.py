#!/usr/bin/env python3
"""Compare legacy SQLite catalog IDs to the authoritative source without writing."""
import argparse
import re
import sqlite3
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--database", required=True)
    parser.add_argument("--catalog-source", required=True)
    args = parser.parse_args()

    source = Path(args.catalog_source).resolve().read_text(encoding="utf-8")
    slugs = re.findall(r'^  \["([^"]+)"', source, re.MULTILINE)
    authoritative_ids = {f"seed-vegetable-{slug}" for slug in slugs}
    database = Path(args.database).resolve().as_posix()
    connection = sqlite3.connect(f"file:{database}?mode=ro&immutable=1", uri=True)
    try:
        rows = connection.execute(
            "SELECT id, user_id, title FROM catalog_items ORDER BY id"
        ).fetchall()
    finally:
        connection.close()

    shared_ids = {row[0] for row in rows if row[1] == "__shared_catalog__"}
    user_rows = [row for row in rows if row[1] != "__shared_catalog__"]
    print(f"authoritative={len(authoritative_ids)} legacy_shared={len(shared_ids)} legacy_total={len(rows)}")
    print(f"missing_shared_ids={sorted(authoritative_ids - shared_ids)}")
    print(f"unexpected_shared_ids={sorted(shared_ids - authoritative_ids)}")
    for item_id, owner_id, title in user_rows:
        print(f"user_owned id={item_id} owner={owner_id} title={title!r}")


if __name__ == "__main__":
    main()
