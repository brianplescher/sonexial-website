.PHONY: install dev worker test lint db-migrate db-upgrade seed scan create-client generate-site create-client-repo

# Package manager detection
UV := $(shell command -v uv 2> /dev/null)
PIP_CMD := $(if $(UV),uv pip,python -m pip)
INSTALL_CMD := $(if $(UV),uv sync,$(PIP_CMD) install -e ".[dev]")

install:
	@if [ -n "$(UV)" ]; then \
		uv sync; \
	else \
		python -m venv .venv && . .venv/bin/activate && pip install -e ".[dev]"; \
	fi

dev:
	uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

worker:
	python -m app.worker.runner

test:
	pytest tests/ -v

lint:
	ruff check app/ scripts/ tests/
	mypy app/

db-migrate:
	@if [ -z "$(msg)" ]; then echo "Usage: make db-migrate msg='migration message'"; exit 1; fi
	alembic revision --autogenerate -m "$(msg)"

db-upgrade:
	alembic upgrade head

seed:
	python scripts/seed_dev.py

scan:
	@if [ -z "$(URL)" ]; then echo "Usage: make scan URL=https://example.com"; exit 1; fi
	python scripts/scan_url.py --url "$(URL)"

create-client:
	@if [ -z "$(EMAIL)" ]; then echo "Usage: make create-client EMAIL=test@example.com"; exit 1; fi
	python scripts/create_client.py --email "$(EMAIL)"

generate-site:
	@if [ -z "$(CLIENT_ID)" ]; then echo "Usage: make generate-site CLIENT_ID=uuid"; exit 1; fi
	python scripts/generate_site.py --client-id "$(CLIENT_ID)"

create-client-repo:
	@if [ -z "$(CLIENT_ID)" ]; then echo "Usage: make create-client-repo CLIENT_ID=uuid"; exit 1; fi
	python scripts/create_client_repo.py --client-id "$(CLIENT_ID)"

create-stripe-products:
	python scripts/create_stripe_products.py

send-test-email:
	python scripts/send_test_email.py

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type d -name "*.egg-info" -exec rm -rf {} +
	find . -type d -name ".pytest_cache" -exec rm -rf {} +
	find . -type d -name ".mypy_cache" -exec rm -rf {} +
	rm -rf dist/ build/
