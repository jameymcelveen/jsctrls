# jsctrls: common tasks. Run `make help` to list them.
.DEFAULT_GOAL := help
SHELL := /bin/bash

# java (default), dotnet, go, or node. Go and node are not implemented.
SERVER ?= java

.PHONY: help install dev dev-web dev-api dev-java dev-dotnet test test-web test-api test-java test-dotnet lint format typecheck build build-java build-dotnet up up-java up-dotnet down logs clean check

help: ## List targets
	@grep -E '^[a-zA-Z0-9_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

install: ## Install JS dependencies
	pnpm install

dev: ## Run the selected API and Vite. SERVER=java (default) or dotnet
	@trap 'kill 0' EXIT; $(MAKE) dev-api SERVER=$(SERVER) & $(MAKE) dev-web & wait

dev-web: ## Run only the Vite dev server
	pnpm --filter hello dev

dev-api: ## Run the selected API on :8081. SERVER=java (default) or dotnet
	@case "$(SERVER)" in \
	  java|dotnet) $(MAKE) dev-$(SERVER) ;; \
	  go|node) echo "server/$(SERVER) is not implemented. Use SERVER=java or SERVER=dotnet." >&2; exit 1 ;; \
	  *) echo "Unknown SERVER=$(SERVER). Use java, dotnet, go, or node." >&2; exit 1 ;; \
	esac

dev-java: ## Run the Spring Boot API on :8081
	cd server/java && ./mvnw spring-boot:run

dev-dotnet: ## Run the .NET API on :8081
	cd server/dotnet && dotnet run --project src/Jsctrls.Demo.csproj --launch-profile http

test: test-web test-java test-dotnet ## Run web tests and both implemented APIs

test-web: ## Vitest for the library and app
	pnpm -r test

test-api: ## Test one API. SERVER=java (default) or dotnet
	@case "$(SERVER)" in \
	  java|dotnet) $(MAKE) test-$(SERVER) ;; \
	  go|node) echo "server/$(SERVER) is not implemented. Use SERVER=java or SERVER=dotnet." >&2; exit 1 ;; \
	  *) echo "Unknown SERVER=$(SERVER). Use java, dotnet, go, or node." >&2; exit 1 ;; \
	esac

test-java: ## Maven tests for the Java API
	cd server/java && ./mvnw -q test

test-dotnet: ## xUnit tests for the .NET API
	cd server/dotnet && dotnet test --nologo

lint: ## ESLint plus a Prettier check
	pnpm -r lint
	pnpm exec prettier --check .

format: ## Format JS/TS with Prettier
	pnpm exec prettier --write .

typecheck: ## TypeScript type check
	pnpm -r typecheck

check: lint typecheck test ## Lint, typecheck, web tests, and both APIs

build: ## Build the library, the app, and the selected API
	pnpm -r build
	@case "$(SERVER)" in \
	  java|dotnet) $(MAKE) build-$(SERVER) ;; \
	  go|node) echo "server/$(SERVER) is not implemented. Use SERVER=java or SERVER=dotnet." >&2; exit 1 ;; \
	  *) echo "Unknown SERVER=$(SERVER). Use java, dotnet, go, or node." >&2; exit 1 ;; \
	esac

build-java: ## Package the Java API
	cd server/java && ./mvnw -q -DskipTests package

build-dotnet: ## Publish the .NET API
	cd server/dotnet && dotnet publish src/Jsctrls.Demo.csproj -c Release --nologo

up: ## Compose the app on :8080. SERVER=java (default) or dotnet
	@case "$(SERVER)" in \
	  java|dotnet) SERVER=$(SERVER) docker compose up --build -d ;; \
	  go|node) echo "server/$(SERVER) is not implemented. Use SERVER=java or SERVER=dotnet." >&2; exit 1 ;; \
	  *) echo "Unknown SERVER=$(SERVER). Use java, dotnet, go, or node." >&2; exit 1 ;; \
	esac

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
