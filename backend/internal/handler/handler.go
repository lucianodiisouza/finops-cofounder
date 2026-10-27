// Package handler expõe a API JSON do FinOps.
package handler

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/lucianodiisouza/finops-cofounder/backend/internal/auth"
	"github.com/lucianodiisouza/finops-cofounder/backend/internal/config"
	"github.com/lucianodiisouza/finops-cofounder/backend/internal/costing"
	"github.com/lucianodiisouza/finops-cofounder/backend/internal/database/sqlc"
)

// Server reúne as dependências dos handlers.
type Server struct {
	cfg     config.Config
	pool    *pgxpool.Pool
	queries *sqlc.Queries
}

// New cria o servidor de handlers.
func New(cfg config.Config, pool *pgxpool.Pool) *Server {
	return &Server{cfg: cfg, pool: pool, queries: sqlc.New(pool)}
}

type contextKey string

const userContextKey contextKey = "user"

// Routes registra todas as rotas da API no mux informado.
func (s *Server) Routes(mux *http.ServeMux) {
	mux.HandleFunc("GET /up", s.handleHealth)

	mux.HandleFunc("POST /api/auth/register", s.handleRegister)
	mux.HandleFunc("POST /api/auth/login", s.handleLogin)
	mux.HandleFunc("POST /api/auth/logout", s.handleLogout)
	mux.HandleFunc("GET /api/me", s.requireAuth(s.handleMe))

	// Endpoint exclusivo de desenvolvimento: só existe com DEV_MODE definido.
	if s.cfg.DevMode {
		mux.HandleFunc("POST /api/dev/login", s.handleDevLogin)
		slog.Warn("DEV_MODE ativo: POST /api/dev/login registrado")
	}

	mux.HandleFunc("GET /api/projects", s.requireAuth(s.handleListProjects))
	mux.HandleFunc("POST /api/projects", s.requireAuth(s.handleCreateProject))
	mux.HandleFunc("PUT /api/projects/{id}", s.requireAuth(s.handleUpdateProject))
	mux.HandleFunc("POST /api/projects/{id}/archive", s.requireAuth(s.handleArchiveProject))
	mux.HandleFunc("DELETE /api/projects/{id}", s.requireAuth(s.handleDeleteProject))
	mux.HandleFunc("GET /api/projects/{id}/summary", s.requireAuth(s.handleProjectSummary))

	mux.HandleFunc("POST /api/projects/{id}/services", s.requireAuth(s.handleCreateService))
	mux.HandleFunc("PUT /api/services/{id}", s.requireAuth(s.handleUpdateService))
	mux.HandleFunc("DELETE /api/services/{id}", s.requireAuth(s.handleDeleteService))

	mux.HandleFunc("GET /api/rates", s.requireAuth(s.handleListRates))
	mux.HandleFunc("PUT /api/rates", s.requireAuth(s.handleUpsertRate))
	mux.HandleFunc("DELETE /api/rates/{id}", s.requireAuth(s.handleDeleteRate))

	mux.HandleFunc("GET /api/dashboard", s.requireAuth(s.handleDashboard))
	mux.HandleFunc("GET /api/evolution", s.requireAuth(s.handleEvolution))
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("ok"))
}

// requireAuth resolve a sessão do cookie e injeta o usuário no contexto.
// Toda rota autenticada passa por aqui; a autorização por dono do recurso é
// aplicada nas próprias queries (todas filtram por user_id).
func (s *Server) requireAuth(next func(http.ResponseWriter, *http.Request)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie(auth.CookieName)
		if err != nil || cookie.Value == "" {
			writeError(w, http.StatusUnauthorized, "não autenticado")
			return
		}
		user, err := s.queries.GetUserBySessionToken(r.Context(), cookie.Value)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				writeError(w, http.StatusUnauthorized, "sessão expirada")
				return
			}
			writeServerError(w, "consultando sessão", err)
			return
		}
		next(w, r.WithContext(context.WithValue(r.Context(), userContextKey, user)))
	}
}

// currentUser devolve o usuário autenticado do contexto.
func currentUser(r *http.Request) sqlc.User {
	user, _ := r.Context().Value(userContextKey).(sqlc.User)
	return user
}

// startSession cria a sessão no banco e grava o cookie.
func (s *Server) startSession(w http.ResponseWriter, r *http.Request, userID uuid.UUID) error {
	token, err := auth.NewToken()
	if err != nil {
		return err
	}
	_, err = s.queries.CreateSession(r.Context(), sqlc.CreateSessionParams{
		Token:     token,
		UserID:    userID,
		ExpiresAt: timestamptz(time.Now().Add(auth.SessionTTL)),
	})
	if err != nil {
		return err
	}
	auth.SetCookie(w, token, s.cfg.DevMode)
	return nil
}

// pathUUID lê um parâmetro de rota como UUID.
func pathUUID(r *http.Request, name string) (uuid.UUID, error) {
	return uuid.Parse(r.PathValue(name))
}

// monthParam lê o parâmetro de query `month` (YYYY-MM), usando o mês atual como padrão.
func monthParam(r *http.Request) (costing.Month, error) {
	raw := r.URL.Query().Get("month")
	if raw == "" {
		return costing.NewMonth(time.Now()), nil
	}
	return costing.ParseMonth(raw)
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(body); err != nil {
		slog.Error("falha ao escrever resposta JSON", "err", err)
	}
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

// writeServerError registra o erro real e devolve uma mensagem genérica ao cliente.
func writeServerError(w http.ResponseWriter, what string, err error) {
	slog.Error("erro interno", "what", what, "err", err)
	writeError(w, http.StatusInternalServerError, "erro interno do servidor")
}

// decodeJSON lê o corpo da requisição, rejeitando campos desconhecidos.
func decodeJSON(w http.ResponseWriter, r *http.Request, dst any) bool {
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20))
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		writeError(w, http.StatusBadRequest, "corpo da requisição inválido")
		return false
	}
	return true
}
