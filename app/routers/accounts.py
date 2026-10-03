from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.db.models import Account
from app.templating import templates

router = APIRouter(prefix="/accounts")


@router.get("")
def list_accounts(request: Request, db: Session = Depends(get_db)):
    accounts = db.query(Account).order_by(Account.currency, Account.name).all()
    return templates.TemplateResponse("accounts.html", {"request": request, "accounts": accounts})


@router.post("")
def create_account(
    name: str = Form(...),
    currency: str = Form(...),
    db: Session = Depends(get_db),
):
    account = Account(name=name.strip(), currency=currency.strip().upper())
    db.add(account)
    db.commit()
    return RedirectResponse(url="/accounts", status_code=303)


@router.post("/{account_id}/toggle")
def toggle_account(request: Request, account_id: int, db: Session = Depends(get_db)):
    account = db.get(Account, account_id)
    if account:
        account.is_active = not account.is_active
        db.commit()
    accounts = db.query(Account).order_by(Account.currency, Account.name).all()
    return templates.TemplateResponse("_accounts_table.html", {"request": request, "accounts": accounts})
