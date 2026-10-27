package handler

import (
	"errors"
	"net/http"
	"net/mail"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/lucianodiisouza/finops-cofounder/backend/internal/auth"
	"github.com/lucianodiisouza/finops-cofounder/backend/internal/database/sqlc"
)

// minPasswordLength é o tamanho mínimo aceito para a senha.
const minPasswordLength = 8

type credentialsRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type userResponse struct {
	ID    string `json:"id"`
	Email string `json:"email"`
}

func (s *Server) handleRegister(w http.ResponseWriter, r *http.Request) {
	var req credentialsRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	email := normalizeEmail(req.Email)
	if _, err := mail.ParseAddress(email); err != nil {
		writeError(w, http.StatusBadRequest, "informe um e-mail válido")
		return
	}
	if len(req.Password) < minPasswordLength {
		writeError(w, http.StatusBadRequest, "a senha precisa ter ao menos 8 caracteres")
		return
	}

	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		writeServerError(w, "gerando hash da senha", err)
		return
	}
	user, err := s.queries.CreateUser(r.Context(), sqlc.CreateUserParams{
		Email:        email,
		PasswordHash: hash,
	})
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			writeError(w, http.StatusConflict, "este e-mail já está cadastrado")
			return
		}
		writeServerError(w, "criando usuário", err)
		return
	}
	if err := s.startSession(w, r, user.ID); err != nil {
		writeServerError(w, "criando sessão", err)
		return
	}
	writeJSON(w, http.StatusCreated, userResponse{ID: user.ID.String(), Email: user.Email})
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var req credentialsRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	user, err := s.queries.GetUserByEmail(r.Context(), normalizeEmail(req.Email))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// Mensagem genérica de propósito: não revela se o e-mail existe.
			writeError(w, http.StatusUnauthorized, "e-mail ou senha incorretos")
			return
		}
		writeServerError(w, "buscando usuário", err)
		return
	}
	if !auth.CheckPassword(user.PasswordHash, req.Password) {
		writeError(w, http.StatusUnauthorized, "e-mail ou senha incorretos")
		return
	}
	if err := s.startSession(w, r, user.ID); err != nil {
		writeServerError(w, "criando sessão", err)
		return
	}
	writeJSON(w, http.StatusOK, userResponse{ID: user.ID.String(), Email: user.Email})
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	if cookie, err := r.Cookie(auth.CookieName); err == nil && cookie.Value != "" {
		if err := s.queries.DeleteSession(r.Context(), cookie.Value); err != nil {
			slogDeleteSessionFailure(err)
		}
	}
	auth.ClearCookie(w, s.cfg.DevMode)
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r)
	writeJSON(w, http.StatusOK, userResponse{ID: user.ID.String(), Email: user.Email})
}

// handleDevLogin autentica sem senha, criando o usuário se preciso.
// Registrado apenas quando DEV_MODE está definido (ver Routes).
func (s *Server) handleDevLogin(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email string `json:"email"`
	}
	if !decodeJSON(w, r, &req) {
		return
	}
	email := normalizeEmail(req.Email)
	if email == "" {
		email = "dev@finops.local"
	}
	user, err := s.queries.UpsertUserForDevLogin(r.Context(), email)
	if err != nil {
		writeServerError(w, "criando usuário de desenvolvimento", err)
		return
	}
	if err := s.startSession(w, r, user.ID); err != nil {
		writeServerError(w, "criando sessão", err)
		return
	}
	writeJSON(w, http.StatusOK, userResponse{ID: user.ID.String(), Email: user.Email})
}

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}
