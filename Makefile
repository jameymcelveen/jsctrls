# jsctrls: common tasks. Run `make help` to list them.
.DEFAULT_GOAL := help
SHELL := /bin/bash

# The demo names API, in several languages. Each server lives in server/<name>/
# and is implemented when it has serve.sh, test.sh, build.sh and a Dockerfile.
SERVERS := java dotnet go node python php rust kotlin
SERVER ?= java

# Servers `make test` runs natively. The rest need their own toolchain; CI runs them all.
TEST_SERVERS ?= java dotnet

.PHONY: help install dev dev-web dev-api test test-web test-api lint format typecheck check build up up-java up-dotnet down logs clean conformance servers

help: ## List targets
	@grep -E '^[a-zA-Z0-9_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

# Fails with a clear message unless SERVER names an implemented server.
define require_server
	@if ! echo " $(SERVERS) " | grep -q " $(SERVER) "; then \
	  echo "Unknown SERVER=$(SERVER). Use one of: $(SERVERS)." >&2; exit 1; \
	elif [ ! -x server/$(SERVER)/serve.sh ]; then \
	  echo "server/$(SERVER) is not implemented yet. Implemented: $$(ls server/*/serve.sh | cut -d/ -f2 | tr '\n' ' ')" >&2; exit 1; \
	fi
endef

servers: ## List the demo servers and which are implemented
	@for s in $(SERVERS); do \
	  if [ -x server/$$s/serve.sh ]; then echo "  $$s"; else echo "  $$s (not implemented)"; fi; \
	done

install: ## Install JS dependencies
	pnpm install

dev: ## Run the selected API and Vite. SERVER=java (default), see make servers
	@trap 'kill 0' EXIT; $(MAKE) dev-api SERVER=$(SERVER) & $(MAKE) dev-web & wait

dev-web: ## Run only the Vite dev server
	pnpm --filter hello dev

dev-api: ## Run the selected API on :8081
	$(require_server)
	cd server/$(SERVER) && SERVER_PORT=8081 ./serve.sh

conformance: ## Run the HTTP conformance suite against the selected API
	$(require_server)
	./conformance/run.sh $(SERVER)

test: test-web ## Web tests plus the TEST_SERVERS APIs (java and dotnet by default)
	@for s in $(TEST_SERVERS); do $(MAKE) --no-print-directory test-api SERVER=$$s || exit 1; done

test-web: ## Vitest for the library and app
	pnpm -r test

test-api: ## Native tests for the selected API
	$(require_server)
	cd server/$(SERVER) && ./test.sh

lint: ## ESLint plus a Prettier check
	pnpm -r lint
	pnpm exec prettier --check .

format: ## Format JS/TS with Prettier
	pnpm exec prettier --write .

typecheck: ## TypeScript type check
	pnpm -r typecheck

check: lint typecheck test ## Lint, typecheck, web tests, and the TEST_SERVERS APIs

build: ## Build the library, the app, and the selected API
	pnpm -r build
	$(require_server)
	cd server/$(SERVER) && ./build.sh

up: ## Compose the app on :8080 with the selected API
	$(require_server)
	SERVER=$(SERVER) docker compose up --build -d

up-java: ## Compose with the Java API
	@$(MAKE) up SERVER=java

up-dotnet: ## Compose with the .NET API
	@$(MAKE) up SERVER=dotnet

down: ## docker compose down
	docker compose down

logs: ## Follow docker compose logs
	docker compose logs -f

clean: ## Remove build output
	rm -rf node_modules packages/*/node_modules apps/*/node_modules packages/*/dist apps/*/dist coverage
	cd server/java && ./mvnw -q clean || true
	cd server/dotnet && dotnet clean --nologo || true
