# Docusaurus Viewer

A zero-dependency standalone executable that serves your Docusaurus documentation site locally.  
No Node.js, no npm, no installation required on the target machine.

## Project Structure

```
docusaurus-viewer/
├── main.go               ← Go server (embeds the build/ folder at compile time)
├── go.mod
├── Makefile
├── build/                ← ⚠️  Place your Docusaurus build output HERE
│   ├── index.html
│   ├── assets/
│   └── ...
├── scripts/
│   ├── build-all.bat     ← Windows build script
│   └── build-all.sh      ← Linux / macOS build script
└── dist/                 ← Generated binaries end up here
```

## Prerequisites

- [Go 1.22+](https://go.dev/dl/) — only needed to **build**, not to run

## Usage

### Step 1 — Build your Docusaurus site

```bash
# In your Docusaurus project:
npm run build
```

### Step 2 — Copy the build output

Copy the generated `build/` folder into the root of this project  
(next to `main.go`), so the structure matches the tree above.

```bash
cp -r /path/to/your-docs/build ./build
```

### Step 3 — Compile

**Windows:**
```bat
scripts\build-all.bat
```

**Linux / macOS:**
```bash
chmod +x scripts/build-all.sh
./scripts/build-all.sh
```

**Or with Make:**
```bash
make all          # build all platforms
make windows      # Windows only
make linux        # Linux x64 only
make run          # run locally for testing
```

### Step 4 — Distribute

Send the appropriate binary from `dist/` to your recipients.  
That's it — one file, double-click, docs open in the browser.

---

## CLI Flags

```
docs-viewer --port 9090          # Use a custom port (default: 8080)
docs-viewer --no-browser         # Don't auto-open the browser
docs-viewer --help               # Show all flags
```

---

## How it Works

- At **compile time**, Go's `//go:embed all:build` directive packs the entire  
  `build/` folder into the binary — no external files needed at runtime.
- At **runtime**, a minimal `net/http` file server serves the embedded content.
- The binary auto-detects a free port if 8080 is busy.
- Browser opens automatically via the OS-native launcher (`rundll32` / `xdg-open` / `open`).

---

## Expected Binary Sizes

| Platform | Approximate Size |
|---|---|
| Windows x64 | ~8–12 MB + docs |
| Linux x64 | ~8–12 MB + docs |
| macOS x64/ARM | ~8–12 MB + docs |

> Sizes above exclude embedded docs. A typical Docusaurus site adds 2–20 MB.

---

## Updating the Docs

Rebuild your Docusaurus site, replace the `build/` folder, and recompile.  
The entire process takes under a minute.
