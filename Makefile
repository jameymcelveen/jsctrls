# jsctrls: common tasks. Run `make help` to list them.
.DEFAULT_GOAL := help
SHELL := /bin/bash

API_DIR := server
MVNW := ./mvnw

.PHONY: help install dev dev-web dev-api test test-web test-api lint format typecheck build up down logs clean check

help: ## List targets
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

install: ## Install JS dependencies
	pnpm install

dev: ## Run the Spring Boot API and the Vite app together
	@trap 'kill 0' EXIT; $(MAKE) dev-api & $(MAKE) dev-web & wait

dev-web: ## Run only the Vite dev server
	pnpm --filter hello dev

dev-api: ## Run only the Spring Boot API on :8081
	cd $(API_DIR) && $(MVNW) spring-boot:run

test: test-web test-api ## Run all tests

test-web: ## Vitest for the library and app
	pnpm -r test

test-api: ## Maven tests for the API
	cd $(API_DIR) && $(MVNW) -q test

lint: ## ESLint plus a Prettier check
	pnpm -r lint
	pnpm exec prettier --check .

format: ## Format JS/TS with Prettier
	pnpm exec prettier --write .

typecheck: ## TypeScript type check
	pnpm -r typecheck

check: lint typecheck test ## Everything CI runs

build: ## Build the library, app and API
	pnpm -r build
	cd $(API_DIR) && $(MVNW) -q -DskipTests package

up: ## docker compose up (app on http://localhost:8080)
	docker compose up --build -d

down: ## docker compose down
	docker compose down

logs: ## Follow docker compose logs
	docker compose logs -f

clean: ## Remove build output
	rm -rf node_modules packages/*/node_modules apps/*/node_modules packages/*/dist apps/*/dist coverage
	cd $(API_DIR) && $(MVNW) -q clean || true
