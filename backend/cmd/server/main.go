// Command server sobe a API do FinOps e serve o frontend em produção.
package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/lucianodiisouza/finops-cofounder/backend/internal/config"
	"github.com/lucianodiisouza/finops-cofounder/backend/internal/database"
	"github.com/lucianodiisouza/finops-cofounder/backend/internal/handler"
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))

	cfg, err := config.Load()
	if err != nil {
		slog.Error("configuração inválida", "err", err)
		os.Exit(1)
	}

	ctx := context.Background()
	pool, err := database.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("falha ao conectar no banco", "err", err)
		os.Exit(1)
	}
	defer pool.Close()

	if err := database.Migrate(ctx, pool); err != nil {
		slog.Error("falha ao aplicar migrations", "err", err)
		os.Exit(1)
	}

	mux := http.NewServeMux()
	handler.New(cfg, pool).Routes(mux)
	registerFrontend(mux, cfg.DevMode)

	server := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           mux,
		ReadHeaderTimeout: 10 * time.Second,
	}
	slog.Info("servidor iniciado", "port", cfg.Port, "dev_mode", cfg.DevMode)
	if err := server.ListenAndServe(); err != nil {
		slog.Error("servidor encerrado", "err", err)
		os.Exit(1)
	}
}

// registerFrontend serve o build do React. Em desenvolvimento o Vite cuida disso,
// então nada é registrado para não conflitar com o proxy.
func registerFrontend(mux *http.ServeMux, devMode bool) {
	if devMode {
		return
	}
	const frontendDist = "frontend/dist"
	if _, err := os.Stat(frontendDist); err != nil {
		slog.Warn("build do frontend não encontrado — rotas do SPA retornarão 404", "path", frontendDist)
		return
	}

	// O shell do SPA é __spa-fallback.html em builds com prerender e index.html nos demais.
	spaShell := "index.html"
	if _, err := os.Stat(filepath.Join(frontendDist, "__spa-fallback.html")); err == nil {
		spaShell = "__spa-fallback.html"
	}
	fs := http.FileServer(http.Dir(frontendDist))

	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") || strings.HasPrefix(r.URL.Path, "/auth/") {
			http.NotFound(w, r)
			return
		}
		if r.URL.Path == "/" {
			fs.ServeHTTP(w, r)
			return
		}
		target := filepath.Join(frontendDist, filepath.Clean(r.URL.Path))
		if info, err := os.Stat(target); err == nil {
			if !info.IsDir() {
				fs.ServeHTTP(w, r) // arquivo real: o FileServer define o Content-Type
				return
			}
			// Página pré-renderizada ("/about" → about/index.html). Servida direto:
			// entregar o diretório ao FileServer causaria um 301 para "/about/".
			page := filepath.Join(target, "index.html")
			if _, err := os.Stat(page); err == nil {
				http.ServeFile(w, r, page)
				return
			}
			// Diretório sem index.html (ex.: /assets/): cai no shell do SPA, porque o
			// FileServer exibiria a listagem dos arquivos internos da aplicação.
		}
		http.ServeFile(w, r, filepath.Join(frontendDist, spaShell))
	})
}
