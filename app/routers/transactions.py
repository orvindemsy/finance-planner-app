from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Optional

from fastapi import APIRouter, Depends, Form, Request
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.db.models import Category, Transaction
from app.templating import templates

router = APIRouter(prefix="/transactions")


def _list_context(
    request: Request,
    db: Session,
    start: Optional[str],
    end: Optional[str],
    category_id: Optional[int],
    q: Optional[str],
) -> dict:
    query = db.query(Transaction)
    if start:
        query = query.filter(Transaction.date >= start)
    if end:
        query = query.filter(Transaction.date <= end)
    if category_id:
        query = query.filter(Transaction.category_id == category_id)
    if q:
        query = query.filter(Transaction.description.ilike(f"%{q}%"))

    transactions = query.order_by(Transaction.date.desc(), Transaction.id.desc()).limit(200).all()
    categories = db.query(Category).filter(Category.is_active.is_(True)).order_by(Category.name).all()

    return {
        "request": request,
        "transactions": transactions,
        "categories": categories,
        "filters": {
            "start": start or "",
            "end": end or "",
            "category_id": category_id or "",
            "q": q or "",
        },
    }


@router.get("")
def list_transactions(
    request: Request,
    start: Optional[str] = None,
    end: Optional[str] = None,
    category_id: Optional[int] = None,
    q: Optional[str] = None,
    db: Session = Depends(get_db),
):
    context = _list_context(request, db, start, end, category_id, q)
    if request.headers.get("HX-Request"):
        return templates.TemplateResponse("_transactions_table.html", context)
    return templates.TemplateResponse("transactions.html", context)


@router.post("")
def create_transaction(
    request: Request,
    date_: date = Form(..., alias="date"),
    category_id: int = Form(...),
    amount: str = Form(...),
    description: Optional[str] = Form(None),
    source: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    try:
        amount_value = abs(Decimal(amount))
    except InvalidOperation:
        amount_value = Decimal("0")

    transaction = Transaction(
        date=date_,
        category_id=category_id,
        amount=amount_value,
        description=description or None,
        source=source or None,
    )
    db.add(transaction)
    db.commit()

    context = _list_context(request, db, None, None, None, None)
    return templates.TemplateResponse("_transactions_table.html", context)
