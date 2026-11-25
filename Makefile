SHELL := /bin/bash

FRONTEND_DIR  := frontend/zmk-editor-ui
DIST_DIR      := $(FRONTEND_DIR)/dist
BINARY        := bin/zmk-editor
DEV_BINARY    := bin/zmk-editor-dev
DEV_PORT_FILE := bin/.zmk-editor-dev-url

GO  ?= go
NPM ?= npm

.PHONY: dev build frontend frontend-install backend release run test check help

## dev: run the Go backend (tag=dev) and the Vite dev server together; Ctrl-C stops both.
##      The backend writes its bound URL to $(DEV_PORT_FILE) and Vite proxies /api there.
dev: frontend-install
	@mkdir -p bin
	@$(GO) build -tags dev -o $(DEV_BINARY) ./cmd/zmk-editor
	@rm -f $(DEV_PORT_FILE)
	@trap 'kill $$VITE_PID $$BACK_PID 2>/dev/null; wait' INT TERM; \
	 $(DEV_BINARY) --no-browser --port-file $(DEV_PORT_FILE) & BACK_PID=$$!; \
	 for _ in $$(seq 1 100); do \
	   [ -s $(DEV_PORT_FILE) ] && break; \
	   kill -0 $$BACK_PID 2>/dev/null || exit 1; \
	   sleep 0.1; \
	 done; \
	 [ -s $(DEV_PORT_FILE) ] || { echo "backend did not start listening"; kill $$BACK_PID; exit 1; }; \
	 BACKEND_URL=$$(cat $(DEV_PORT_FILE)); echo "backend: $$BACKEND_URL"; \
	 ( cd $(FRONTEND_DIR) && ZMK_EDITOR_BACKEND_URL=$$BACKEND_URL $(NPM) run dev ) & VITE_PID=$$!; \
	 wait

## build: build the frontend, then the Go binary with it embedded -> $(BINARY).
build: frontend backend

## frontend: install deps (if missing) and produce dist/.
frontend: frontend-install
	cd $(FRONTEND_DIR) && $(NPM) run build

frontend-install:
	@if [ ! -d $(FRONTEND_DIR)/node_modules ]; then \
		cd $(FRONTEND_DIR) && $(NPM) install; \
	fi

## backend: build the Go binary (expects $(DIST_DIR) to exist for embedding).
backend:
	@if [ ! -f $(DIST_DIR)/index.html ]; then \
		echo "ERROR: $(DIST_DIR)/index.html missing - run 'make frontend' first."; \
		exit 1; \
	fi
	@mkdir -p bin
	CGO_ENABLED=0 $(GO) build -trimpath -ldflags "-s -w" -o $(BINARY) ./cmd/zmk-editor

## release: cross-compile single binaries for macOS, Linux and Windows into bin/release/.
release: frontend
	@mkdir -p bin/release
	@for target in darwin/arm64 darwin/amd64 linux/amd64 linux/arm64 windows/amd64; do \
	  os=$${target%/*}; arch=$${target#*/}; ext=""; [ $$os = windows ] && ext=".exe"; \
	  echo "building $$os/$$arch"; \
	  CGO_ENABLED=0 GOOS=$$os GOARCH=$$arch $(GO) build -trimpath -ldflags "-s -w" \
	    -o bin/release/zmk-editor-$$os-$$arch$$ext ./cmd/zmk-editor || exit 1; \
	done

## run: build and execute the production binary.
run: build
	./$(BINARY)

## test: run Go tests.
test:
	$(GO) test ./...

## check: everything that must pass before calling a change done.
check:
	$(GO) build ./... && $(GO) vet ./... && $(GO) test ./... && test -z "$$(gofmt -l internal/ cmd/)"
	cd $(FRONTEND_DIR) && $(NPM) run typecheck && $(NPM) run lint && $(NPM) run build

help:
	@grep -E '^## ' Makefile | sed 's/^## //'
