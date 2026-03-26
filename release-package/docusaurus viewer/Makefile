APP_NAME  := docs-viewer
BUILD_DIR := dist
LDFLAGS   := -ldflags="-s -w"

.PHONY: all clean windows linux linux-arm darwin darwin-arm check-build

all: check-build windows linux linux-arm darwin darwin-arm
	@echo ""
	@echo "✅ All builds complete → $(BUILD_DIR)/"
	@ls -lh $(BUILD_DIR)/

check-build:
	@if [ ! -d "build" ]; then \
		echo ""; \
		echo "❌ ERROR: 'build/' folder not found."; \
		echo "   Run: npm run build   (in your Docusaurus project)"; \
		echo "   Then copy the 'build/' folder next to this Makefile."; \
		echo ""; \
		exit 1; \
	fi

windows:
	GOOS=windows GOARCH=amd64 go build $(LDFLAGS) -o $(BUILD_DIR)/$(APP_NAME)-windows-amd64.exe .

linux:
	GOOS=linux GOARCH=amd64 go build $(LDFLAGS) -o $(BUILD_DIR)/$(APP_NAME)-linux-amd64 .

linux-arm:
	GOOS=linux GOARCH=arm64 go build $(LDFLAGS) -o $(BUILD_DIR)/$(APP_NAME)-linux-arm64 .

darwin:
	GOOS=darwin GOARCH=amd64 go build $(LDFLAGS) -o $(BUILD_DIR)/$(APP_NAME)-darwin-amd64 .

darwin-arm:
	GOOS=darwin GOARCH=arm64 go build $(LDFLAGS) -o $(BUILD_DIR)/$(APP_NAME)-darwin-arm64 .

clean:
	rm -rf $(BUILD_DIR)

run: check-build
	go run . --port 8080
