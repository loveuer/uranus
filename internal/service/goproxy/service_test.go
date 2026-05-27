package goproxy

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHTTPProxyFetcher_ListEscapesModulePath(t *testing.T) {
	// Mock upstream that records the request path and checks encoding
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// The path must have case-encoded uppercase: K → !k, B → !b
		expectedPrefix := "/github.com/!kyle!banks/depth"
		if !strings.HasPrefix(r.URL.Path, expectedPrefix) {
			t.Errorf("unencoded uppercase in URL path: got %q, want prefix %q", r.URL.Path, expectedPrefix)
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}
		fmt.Fprintln(w, "v1.0.0")
		fmt.Fprintln(w, "v1.2.1")
	}))
	defer ts.Close()

	f := newHTTPProxyFetcher(ts.URL, "")
	versions, err := f.List(context.Background(), "github.com/KyleBanks/depth")
	if err != nil {
		t.Fatalf("List failed: %v", err)
	}
	if len(versions) != 2 || versions[0] != "v1.0.0" || versions[1] != "v1.2.1" {
		t.Errorf("unexpected versions: %v", versions)
	}
}

func TestHTTPProxyFetcher_QueryEscapesModulePath(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		expectedPath := "/github.com/!kyle!banks/depth/@v/v1.2.1.info"
		if r.URL.Path != expectedPath {
			t.Errorf("unencoded path: got %q, want %q", r.URL.Path, expectedPath)
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintln(w, `{"Version":"v1.2.1","Time":"2023-01-01T00:00:00Z"}`)
	}))
	defer ts.Close()

	f := newHTTPProxyFetcher(ts.URL, "")
	version, _, err := f.Query(context.Background(), "github.com/KyleBanks/depth", "v1.2.1")
	if err != nil {
		t.Fatalf("Query failed: %v", err)
	}
	if version != "v1.2.1" {
		t.Errorf("unexpected version: %s", version)
	}
}

func TestHTTPProxyFetcher_QueryLatestEscapesModulePath(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		expectedPath := "/github.com/!kyle!banks/depth/@latest"
		if r.URL.Path != expectedPath {
			t.Errorf("unencoded path: got %q, want %q", r.URL.Path, expectedPath)
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintln(w, `{"Version":"v1.2.1","Time":"2023-01-01T00:00:00Z"}`)
	}))
	defer ts.Close()

	f := newHTTPProxyFetcher(ts.URL, "")
	version, _, err := f.Query(context.Background(), "github.com/KyleBanks/depth", "latest")
	if err != nil {
		t.Fatalf("Query latest failed: %v", err)
	}
	if version != "v1.2.1" {
		t.Errorf("unexpected version: %s", version)
	}
}

func TestHTTPProxyFetcher_DownloadEscapesModulePath(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		switch {
		case strings.HasSuffix(path, ".info"):
			if path != "/github.com/!kyle!banks/depth/@v/v1.2.1.info" {
				t.Errorf("unexpected info path: %q", path)
				http.Error(w, "bad request", http.StatusBadRequest)
				return
			}
			fmt.Fprintln(w, `{"Version":"v1.2.1","Time":"2023-01-01T00:00:00Z"}`)
		case strings.HasSuffix(path, ".mod"):
			if path != "/github.com/!kyle!banks/depth/@v/v1.2.1.mod" {
				t.Errorf("unexpected mod path: %q", path)
				http.Error(w, "bad request", http.StatusBadRequest)
				return
			}
			fmt.Fprintln(w, "module github.com/KyleBanks/depth")
		case strings.HasSuffix(path, ".zip"):
			if path != "/github.com/!kyle!banks/depth/@v/v1.2.1.zip" {
				t.Errorf("unexpected zip path: %q", path)
				http.Error(w, "bad request", http.StatusBadRequest)
				return
			}
			w.Write([]byte{0x50, 0x4B, 0x03, 0x04}) // zip magic bytes
		default:
			t.Errorf("unexpected path: %q", path)
			http.Error(w, "bad request", http.StatusBadRequest)
		}
	}))
	defer ts.Close()

	f := newHTTPProxyFetcher(ts.URL, "")
	info, mod, zip, err := f.Download(context.Background(), "github.com/KyleBanks/depth", "v1.2.1")
	if err != nil {
		t.Fatalf("Download failed: %v", err)
	}
	defer info.Close()
	defer mod.Close()
	defer zip.Close()
}

func TestHTTPProxyFetcher_ColonInVersionEscapesCorrectly(t *testing.T) {
	// Versions with ":" such as pseudo-versions need EscapeVersion
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// The colon in "v0.0.0-20230101000000-abcdefabcdef" does NOT need escaping
		// because it's not in the version part of a URL path.
		// But test that our implementation handles it gracefully.
		expectedPath := "/github.com/example/module/@v/v0.0.0-20230101000000-abcdefabcdef.info"
		if r.URL.Path != expectedPath {
			t.Errorf("unexpected path: got %q, want %q", r.URL.Path, expectedPath)
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}
		fmt.Fprintln(w, `{"Version":"v0.0.0-20230101000000-abcdefabcdef","Time":"2023-01-01T00:00:00Z"}`)
	}))
	defer ts.Close()

	f := newHTTPProxyFetcher(ts.URL, "")
	version, _, err := f.Query(context.Background(), "github.com/example/module", "v0.0.0-20230101000000-abcdefabcdef")
	if err != nil {
		t.Fatalf("Query failed: %v", err)
	}
	if version != "v0.0.0-20230101000000-abcdefabcdef" {
		t.Errorf("unexpected version: %s", version)
	}
}

func TestHTTPProxyFetcher_ListRealUpstream(t *testing.T) {
	// Integration test: fetch from real goproxy.cn
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	f := newHTTPProxyFetcher("https://goproxy.cn", "")
	versions, err := f.List(context.Background(), "github.com/KyleBanks/depth")
	if err != nil {
		t.Fatalf("List failed: %v", err)
	}

	t.Logf("versions: %v", versions)

	// v1.2.1 must be present
	found := false
	for _, v := range versions {
		if v == "v1.2.1" {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("v1.2.1 not found in versions: %v", versions)
	}
}

func TestHTTPProxyFetcher_DownloadRealUpstream(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	f := newHTTPProxyFetcher("https://goproxy.cn", "")
	info, mod, zip, err := f.Download(context.Background(), "github.com/KyleBanks/depth", "v1.2.1")
	if err != nil {
		t.Fatalf("Download failed: %v", err)
	}
	defer info.Close()
	defer mod.Close()
	defer zip.Close()

	// Read a few bytes to verify non-empty
	buf := make([]byte, 10)
	n, err := info.Read(buf)
	if err != nil {
		t.Errorf("info read failed: %v", err)
	}
	if n == 0 {
		t.Error("info is empty")
	}

	n, err = mod.Read(buf)
	if err != nil {
		t.Errorf("mod read failed: %v", err)
	}
	if n == 0 {
		t.Error("mod is empty")
	}

	n, err = zip.Read(buf)
	if err != nil {
		t.Errorf("zip read failed: %v", err)
	}
	if n == 0 {
		t.Error("zip is empty")
	}
}
