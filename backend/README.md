# Retained legacy SQLite data

The Rust server is retired and is not a supported Calorie Canvas runtime. The
unreviewed `data/calorie_canvas.sqlite3` file is intentionally retained as a
read-only migration source. Do not start an application against it or modify it.

Use `server/migration-tooling/export-legacy-sqlite.py` to inspect/export this
data into a reviewable JSON artifact. Its source schema and field mappings are
documented in `server/migration-tooling/INVENTORY.md`. The Express/PostgreSQL
application does not open this file.
