package server

import (
	"crypto/sha256"
	"embed"
	"fmt"
	"io/fs"
	"net/http"
	"strings"
	"sync"
)

// widgetFiles ships the widget runtime with the binary. The admin editor and
// these files are a single versioned contract; serving them from a separately
// updated directory is what let self-hosted installations run a new editor
// against an old widget.
//
//go:embed all:widget_dist
var widgetFiles embed.FS

func embeddedWidgetHandler() http.Handler {
	sub, err := fs.Sub(widgetFiles, "widget_dist")
	if err != nil {
		panic(err)
	}
	files := http.FileServer(http.FS(sub))
	etags := embeddedWidgetETags()
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if tag := etags[r.URL.Path]; tag != "" {
			w.Header().Set("ETag", tag)
		}
		files.ServeHTTP(w, r)
	})
}

var (
	widgetETagsOnce sync.Once
	widgetETags     map[string]string
)

func embeddedWidgetETags() map[string]string {
	widgetETagsOnce.Do(func() {
		widgetETags = make(map[string]string)
		_ = fs.WalkDir(widgetFiles, "widget_dist", func(path string, entry fs.DirEntry, err error) error {
			if err != nil || entry.IsDir() {
				return err
			}
			body, readErr := widgetFiles.ReadFile(path)
			if readErr != nil {
				return readErr
			}
			sum := sha256.Sum256(body)
			widgetETags["/"+strings.TrimPrefix(path, "widget_dist/")] = fmt.Sprintf(`"%x"`, sum[:8])
			return nil
		})
	})
	return widgetETags
}

func isEmbeddedWidgetPath(path string) bool {
	switch path {
	case "/loader.js", "/reviews-widget.js", "/reviews-widget.css":
		return true
	}
	return strings.HasPrefix(path, "/assets/")
}

func widgetAndStaticHandler(staticDir string) http.Handler {
	embedded := embeddedWidgetHandler()
	external := http.FileServer(http.Dir(staticDir))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if isEmbeddedWidgetPath(r.URL.Path) {
			embedded.ServeHTTP(w, r)
			return
		}
		external.ServeHTTP(w, r)
	})
}
