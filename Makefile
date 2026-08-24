build-amd:
	docker build . -f ./Dockerfile -t finance-planner --build-arg BUILDPLATFORM=linux/amd64

build-arm:
	docker build . -f ./Dockerfile -t finance-planner --build-arg BUILDPLATFORM=linux/arm64

bash:
	docker run --rm -it finance-planner bash

rm:
	docker image rm finance-planner

install:
	poetry install

migrate:
	poetry run alembic upgrade head

migration:
	poetry run alembic revision --autogenerate -m "$(name)"

import:
	poetry run python scripts/import_csv.py

import-dry-run:
	poetry run python scripts/import_csv.py --dry-run

dev:
	poetry run uvicorn app.main:app --reload --port 8000

run:
	docker run --rm -it -p 8000:8000 -v $(PWD)/data:/app/data finance-planner
