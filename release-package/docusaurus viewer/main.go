package main

import (
	"embed"
	"flag"
	"fmt"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"strconv"
	"time"
)

//go:embed all:build
var docsFS embed.FS

const (
	defaultPort    = 8080
	appName        = "Docusaurus Viewer"
	defaultBrowser = true
)

func main() {
	port := flag.Int("port", defaultPort, "Port to serve on")
	noBrowser := flag.Bool("no-browser", false, "Do not open browser automatically")
	flag.Parse()

	// Find a free port if the default is taken
	actualPort := findAvailablePort(*port)
	if actualPort != *port {
		fmt.Printf("[%s] Port %d was busy, using port %d instead\n", appName, *port, actualPort)
	}

	addr := fmt.Sprintf(":%d", actualPort)
	url := fmt.Sprintf("http://localhost:%d", actualPort)

	// Strip the "build/" prefix so "/" maps directly to build/index.html
	subFS, err := fs.Sub(docsFS, "build")
	if err != nil {
		log.Fatalf("Failed to load embedded docs: %v", err)
	}

	mux := http.NewServeMux()
	mux.Handle("/", http.FileServer(http.FS(subFS)))

	fmt.Printf("\n╔══════════════════════════════════════╗\n")
	fmt.Printf("║         %s              ║\n", appName)
	fmt.Printf("╠══════════════════════════════════════╣\n")
	fmt.Printf("║  URL  : %-29s ║\n", url)
	fmt.Printf("║  Port : %-29s ║\n", strconv.Itoa(actualPort))
	fmt.Printf("║  Press Ctrl+C to stop                ║\n")
	fmt.Printf("╚══════════════════════════════════════╝\n\n")

	// Open browser after a short delay to let the server start
	if !*noBrowser {
		go func() {
			time.Sleep(300 * time.Millisecond)
			if err := openBrowser(url); err != nil {
				fmt.Printf("[%s] Could not open browser automatically: %v\n", appName, err)
				fmt.Printf("[%s] Please open manually: %s\n", appName, url)
			}
		}()
	}

	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

// findAvailablePort checks if the preferred port is free, and if not, scans upward
func findAvailablePort(preferred int) int {
	for port := preferred; port < preferred+100; port++ {
		ln, err := net.Listen("tcp", fmt.Sprintf(":%d", port))
		if err == nil {
			ln.Close()
			return port
		}
	}
	// Fallback: let the OS assign a port
	ln, err := net.Listen("tcp", ":0")
	if err != nil {
		log.Fatal("No available ports found")
	}
	defer ln.Close()
	return ln.Addr().(*net.TCPAddr).Port
}

// openBrowser launches the default system browser
func openBrowser(url string) error {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	case "darwin":
		cmd = exec.Command("open", url)
	case "linux":
		// Try common Linux browser launchers in order
		for _, launcher := range []string{"xdg-open", "gnome-open", "kde-open", "sensible-browser"} {
			if path, err := exec.LookPath(launcher); err == nil {
				cmd = exec.Command(path, url)
				break
			}
		}
		if cmd == nil {
			return fmt.Errorf("no browser launcher found (xdg-open, gnome-open, etc.)")
		}
	default:
		return fmt.Errorf("unsupported OS: %s", runtime.GOOS)
	}

	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Start()
}
