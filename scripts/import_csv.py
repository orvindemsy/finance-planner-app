"""One-time import of exported Google Sheet CSV tabs into the budget tracker database.

Usage:
    python scripts/import_csv.py [--csv-dir data/csv_import] [--dry-run] [--sheet income]
"""
import argparse
import hashlib
import sys
from decimal import Decimal, InvalidOperation
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db.base import SessionLocal  # noqa: E402
from app.db.models import Category, CategoryType, Transaction  # noqa: E402

# ============ EDIT THIS SECTION PER YOUR GOOGLE SHEET EXPORT ============
# Each entry describes one exported CSV tab. Adjust "file" to match the
# exported filename, and "column_map" to map your sheet's column headers
# (left) to the fields this script expects (right): date, category, amount,
# description. Run with --dry-run first and iterate on this config until the
# preview output looks correct before running a real import.
SHEET_CONFIGS = {
    "income": {
        "file": "income.csv",
        "category_type": CategoryType.INCOME,
        "column_map": {
            "Date": "date",
            "Category": "category",
            "Amount": "amount",
            "Notes": "description",
        },
        "date_format": "%m/%d/%Y",
    },
    "expenses": {
        "file": "expenses.csv",
        "category_type": CategoryType.EXPENSE,
        "column_map": {
            "Date": "date",
            "Category": "category",
            "Amount": "amount",
            "Notes": "description",
        },
        "date_format": "%m/%d/%Y",
    },
}
# ==========================================================================


def load_csv(path: Path, cfg: dict) -> pd.DataFrame:
    df = pd.read_csv(path)
    df = df.rename(columns=cfg["column_map"])
    required = {"date", "category", "amount"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"{path.name}: missing required columns after mapping: {missing}")
    df["date"] = pd.to_datetime(df["date"], format=cfg.get("date_format"), errors="coerce")
    df = df.dropna(subset=["date", "amount"])
    if "description" not in df.columns:
        df["description"] = None
    return df


def get_or_create_category(session, name: str, category_type: CategoryType) -> Category:
    clean_name = name.strip()
    category = (
        session.query(Category)
        .filter(Category.name.ilike(clean_name))
        .first()
    )
    if category:
        return category
    category = Category(name=clean_name, type=category_type)
    session.add(category)
    session.flush()
    return category


def build_external_ref(sheet_name: str, date_str: str, amount: str, description: str) -> str:
    raw = f"{sheet_name}|{date_str}|{amount}|{description or ''}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def parse_amount(value) -> Decimal:
    try:
        return abs(Decimal(str(value)))
    except InvalidOperation:
        return Decimal("0")


def process_sheet(session, sheet_name: str, cfg: dict, csv_dir: Path, dry_run: bool) -> dict:
    path = csv_dir / cfg["file"]
    if not path.exists():
        print(f"[{sheet_name}] SKIPPED - file not found: {path}")
        return {"rows": 0, "categories_created": 0, "inserted": 0, "skipped": 0}

    df = load_csv(path, cfg)
    stats = {"rows": len(df), "categories_created": 0, "inserted": 0, "skipped": 0}

    for _, row in df.iterrows():
        category_name = str(row["category"]).strip()
        date_str = row["date"].strftime("%Y-%m-%d")
        amount = parse_amount(row["amount"])
        description = str(row["description"]) if pd.notna(row.get("description")) else None
        external_ref = build_external_ref(sheet_name, date_str, str(amount), description)

        if dry_run:
            print(f"[{sheet_name}] {date_str} | {category_name} | {amount} | {description}")
            continue

        existing_categories_before = session.query(Category).count()
        category = get_or_create_category(session, category_name, cfg["category_type"])
        if session.query(Category).count() > existing_categories_before:
            stats["categories_created"] += 1

        existing = (
            session.query(Transaction)
            .filter(Transaction.external_ref == external_ref)
            .first()
        )
        if existing:
            stats["skipped"] += 1
            continue

        session.add(
            Transaction(
                date=row["date"].date(),
                amount=amount,
                category_id=category.id,
                description=description,
                source="csv_import",
                external_ref=external_ref,
            )
        )
        stats["inserted"] += 1

    if not dry_run:
        session.commit()

    return stats


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv-dir", default="data/csv_import")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--sheet", default=None, help="Run only this sheet from SHEET_CONFIGS")
    args = parser.parse_args()

    csv_dir = Path(args.csv_dir)
    configs = SHEET_CONFIGS
    if args.sheet:
        if args.sheet not in configs:
            raise SystemExit(f"Unknown sheet '{args.sheet}'. Options: {list(configs)}")
        configs = {args.sheet: configs[args.sheet]}

    session = SessionLocal()
    try:
        for sheet_name, cfg in configs.items():
            stats = process_sheet(session, sheet_name, cfg, csv_dir, args.dry_run)
            print(
                f"[{sheet_name}] rows={stats['rows']} "
                f"categories_created={stats['categories_created']} "
                f"inserted={stats['inserted']} skipped={stats['skipped']}"
            )
    finally:
        session.close()


if __name__ == "__main__":
    main()
