"""One-time import of exported Google Sheet ledger tabs into the budget tracker database.

Usage:
    python scripts/import_csv.py --year 2026 [--csv-dir data/csv_import] [--dry-run] [--sheet ledger_jpy]
"""
import argparse
import hashlib
import re
import sys
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Optional

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db.base import SessionLocal  # noqa: E402
from app.db.models import (  # noqa: E402
    Account,
    Category,
    CategoryType,
    Transaction,
    TransactionDirection,
    TransactionStatus,
)

# ============ EDIT THIS SECTION PER YOUR GOOGLE SHEET EXPORT ============
# Export each ledger tab as CSV into data/csv_import/ with these exact
# filenames. If your sheet's category names differ, update CATEGORY_TYPE_MAP
# below (any category not listed here is skipped with a warning, so nothing
# gets imported with a guessed type).
LEDGER_CONFIGS = {
    "ledger_jpy": {"file": "ledger_jpy.csv", "currency": "JPY"},
    "ledger_idr": {"file": "ledger_idr.csv", "currency": "IDR"},
}

CATEGORY_TYPE_MAP = {
    "groceries": CategoryType.EXPENSE,
    "utilities": CategoryType.EXPENSE,
    "utilities/personal": CategoryType.EXPENSE,
    "entertainment": CategoryType.EXPENSE,
    "housing": CategoryType.EXPENSE,
    "housing needs": CategoryType.EXPENSE,
    "rent": CategoryType.EXPENSE,
    "transport": CategoryType.EXPENSE,
    "personal": CategoryType.EXPENSE,
    "online shop": CategoryType.EXPENSE,
    "others": CategoryType.EXPENSE,
    "job": CategoryType.INCOME,
    "income": CategoryType.INCOME,
    "interest/others": CategoryType.INCOME,
    "invest": CategoryType.SAVINGS,
    "transfer to idr": CategoryType.SAVINGS,
    "internal transfer": CategoryType.TRANSFER,
    "moving money": CategoryType.TRANSFER,
    "withdraw money": CategoryType.TRANSFER,
}
# ==========================================================================

JP_DATE_RE = re.compile(r"(\d{1,2})月(\d{1,2})日")


def parse_japanese_date(value: str, year: int):
    if not isinstance(value, str):
        return None
    match = JP_DATE_RE.search(value)
    if not match:
        return None
    month, day = int(match.group(1)), int(match.group(2))
    try:
        return pd.Timestamp(year=year, month=month, day=day).date()
    except ValueError:
        return None


def parse_amount(value) -> Optional[Decimal]:
    if pd.isna(value):
        return None
    cleaned = re.sub(r"[^\d.]", "", str(value))
    if not cleaned:
        return None
    try:
        amount = Decimal(cleaned)
    except InvalidOperation:
        return None
    return amount if amount != 0 else None


def category_type_for(name: str) -> Optional[CategoryType]:
    return CATEGORY_TYPE_MAP.get(name.strip().lower())


def get_or_create_category(session, name: str, category_type: CategoryType) -> Category:
    clean_name = name.strip()
    category = session.query(Category).filter(Category.name.ilike(clean_name)).first()
    if category:
        return category
    category = Category(name=clean_name, type=category_type)
    session.add(category)
    session.flush()
    return category


def get_or_create_account(session, name: str, currency: str) -> Account:
    clean_name = name.strip()
    account = session.query(Account).filter(Account.name.ilike(clean_name)).first()
    if account:
        return account
    account = Account(name=clean_name, currency=currency)
    session.add(account)
    session.flush()
    return account


def build_external_ref(sheet_name: str, account: str, direction: str, date_str: str, amount: str, description: str) -> str:
    raw = f"{sheet_name}|{account}|{direction}|{date_str}|{amount}|{description or ''}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def normalize_jpy_rows(df: pd.DataFrame, year: int):
    """Yield normalized dicts from the 'Ledger' tab export.

    Expected columns: Month, Date, Cashflow, Category, Payment Type,
    Description, Amount, Status, Notes.
    """
    # A handful of rows use "Internal Transfer" as the Cashflow value itself
    # (instead of Outflow/Inflow) for self-transfers between own accounts.
    # These are always paired with an Internal Transfer/Moving Money/Withdraw
    # Money category (TRANSFER type, excluded from budget totals), so the
    # direction only affects how the raw ledger displays, not any totals.
    CASHFLOW_DIRECTION = {
        "inflow": TransactionDirection.INFLOW,
        "outflow": TransactionDirection.OUTFLOW,
        "internal transfer": TransactionDirection.OUTFLOW,
    }
    for _, row in df.iterrows():
        date_val = parse_japanese_date(row.get("Date"), year)
        amount = parse_amount(row.get("Amount"))
        cashflow = str(row.get("Cashflow", "")).strip().lower()
        if date_val is None or amount is None or cashflow not in CASHFLOW_DIRECTION:
            continue
        category = row.get("Category")
        if not isinstance(category, str) or not category.strip():
            continue
        status_raw = str(row.get("Status", "")).strip().lower()
        status = TransactionStatus.PENDING if status_raw == "pending" else TransactionStatus.FINALIZED
        yield {
            "date": date_val,
            "category": category,
            "account": str(row.get("Payment Type", "")).strip() or "Unspecified",
            "amount": amount,
            "direction": CASHFLOW_DIRECTION[cashflow],
            "description": str(row["Description"]) if pd.notna(row.get("Description")) else None,
            "notes": str(row["Notes"]) if pd.notna(row.get("Notes")) else None,
            "status": status,
        }


def normalize_idr_rows(df: pd.DataFrame, year: int):
    """Yield normalized dicts from the 'IDR Ledger' tab export.

    Expected columns: Month, Date, Category, Payment Type, Expense, Income.
    Direction and amount come from whichever of Expense/Income is populated.
    """
    for _, row in df.iterrows():
        date_val = parse_japanese_date(row.get("Date"), year)
        if date_val is None:
            continue
        category = row.get("Category")
        if not isinstance(category, str) or not category.strip():
            continue
        expense_amount = parse_amount(row.get("Expense"))
        income_amount = parse_amount(row.get("Income"))
        if expense_amount is not None:
            amount, direction = expense_amount, TransactionDirection.OUTFLOW
        elif income_amount is not None:
            amount, direction = income_amount, TransactionDirection.INFLOW
        else:
            continue
        yield {
            "date": date_val,
            "category": category,
            "account": str(row.get("Payment Type", "")).strip() or "Unspecified",
            "amount": amount,
            "direction": direction,
            "description": None,
            "notes": None,
            "status": TransactionStatus.FINALIZED,
        }


NORMALIZERS = {
    "ledger_jpy": normalize_jpy_rows,
    "ledger_idr": normalize_idr_rows,
}


def process_sheet(session, sheet_name: str, cfg: dict, csv_dir: Path, year: int, dry_run: bool) -> dict:
    path = csv_dir / cfg["file"]
    if not path.exists():
        print(f"[{sheet_name}] SKIPPED - file not found: {path}")
        return {"rows": 0, "inserted": 0, "skipped_dupe": 0, "skipped_unmapped_category": 0}

    df = pd.read_csv(path, dtype=str)
    normalize = NORMALIZERS[sheet_name]
    stats = {"rows": 0, "inserted": 0, "skipped_dupe": 0, "skipped_unmapped_category": 0}

    for entry in normalize(df, year):
        stats["rows"] += 1
        category_type = category_type_for(entry["category"])
        if category_type is None:
            print(f"[{sheet_name}] SKIPPED - unmapped category '{entry['category']}'; add it to CATEGORY_TYPE_MAP")
            stats["skipped_unmapped_category"] += 1
            continue

        date_str = entry["date"].strftime("%Y-%m-%d")
        external_ref = build_external_ref(
            sheet_name, entry["account"], entry["direction"].value, date_str, str(entry["amount"]), entry["description"]
        )

        if dry_run:
            print(
                f"[{sheet_name}] {date_str} | {entry['direction'].value:7} | {entry['category']:20} | "
                f"{entry['account']:15} | {entry['amount']} | {entry['description'] or ''}"
            )
            continue

        existing = session.query(Transaction).filter(Transaction.external_ref == external_ref).first()
        if existing:
            stats["skipped_dupe"] += 1
            continue

        category = get_or_create_category(session, entry["category"], category_type)
        account = get_or_create_account(session, entry["account"], cfg["currency"])

        session.add(
            Transaction(
                date=entry["date"],
                amount=entry["amount"],
                direction=entry["direction"],
                status=entry["status"],
                category_id=category.id,
                account_id=account.id,
                description=entry["description"],
                notes=entry["notes"],
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
    parser.add_argument("--sheet", default=None, help="Run only this sheet from LEDGER_CONFIGS")
    parser.add_argument("--year", type=int, required=True, help="Calendar year to combine with the sheet's MM月DD日 dates")
    args = parser.parse_args()

    csv_dir = Path(args.csv_dir)
    configs = LEDGER_CONFIGS
    if args.sheet:
        if args.sheet not in configs:
            raise SystemExit(f"Unknown sheet '{args.sheet}'. Options: {list(configs)}")
        configs = {args.sheet: configs[args.sheet]}

    session = SessionLocal()
    try:
        for sheet_name, cfg in configs.items():
            stats = process_sheet(session, sheet_name, cfg, csv_dir, args.year, args.dry_run)
            print(
                f"[{sheet_name}] rows={stats['rows']} inserted={stats['inserted']} "
                f"skipped_dupe={stats['skipped_dupe']} skipped_unmapped_category={stats['skipped_unmapped_category']}"
            )
    finally:
        session.close()


if __name__ == "__main__":
    main()
