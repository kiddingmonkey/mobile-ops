.PHONY: build tidy run test clean

APP_NAME := mobile-ops
BIN_DIR := bin
GO := go

tidy:
	$(GO) mod tidy

build: tidy
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 $(GO) build -o $(BIN_DIR)/$(APP_NAME) ./cmd/server

build-local: tidy
	$(GO) build -o $(BIN_DIR)/$(APP_NAME) ./cmd/server

run: build-local
	./$(BIN_DIR)/$(APP_NAME) --config=config.yaml

init-admin:
	./$(BIN_DIR)/$(APP_NAME) --config=config.yaml --init-admin --admin-user=admin --admin-pass=$(PASS)

test:
	$(GO) test ./...

clean:
	rm -rf $(BIN_DIR)

package: build
	tar czf $(APP_NAME).tar.gz $(BIN_DIR)/$(APP_NAME) config.example.yaml migrations/
