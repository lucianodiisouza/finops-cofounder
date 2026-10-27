package handler

import (
	"errors"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/lucianodiisouza/finops-cofounder/backend/internal/database/sqlc"
)

// maxNameLength limita o tamanho de nomes para evitar abuso de entrada.
const maxNameLength = 120

type projectResponse struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Color       string `json:"color"`
	Archived    bool   `json:"archived"`
}

func toProjectResponse(p sqlc.Project) projectResponse {
	return projectResponse{
		ID:          p.ID.String(),
		Name:        p.Name,
		Description: p.Description,
		Color:       p.Color,
		Archived:    p.ArchivedAt.Valid,
	}
}

type projectRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Color       string `json:"color"`
}

// validate normaliza e valida os campos do projeto.
func (req *projectRequest) validate() string {
	req.Name = strings.TrimSpace(req.Name)
	req.Description = strings.TrimSpace(req.Description)
	req.Color = strings.TrimSpace(req.Color)
	if req.Name == "" {
		return "o nome do projeto é obrigatório"
	}
	if len(req.Name) > maxNameLength {
		return "o nome do projeto é muito longo"
	}
	if req.Color == "" {
		req.Color = "#3b82f6"
	}
	if !isHexColor(req.Color) {
		return "a cor deve estar no formato #RRGGBB"
	}
	return ""
}

func isHexColor(s string) bool {
	if len(s) != 7 || s[0] != '#' {
		return false
	}
	for _, c := range s[1:] {
		isHexDigit := (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')
		if !isHexDigit {
			return false
		}
	}
	return true
}

func (s *Server) handleListProjects(w http.ResponseWriter, r *http.Request) {
	projects, err := s.queries.ListProjects(r.Context(), currentUser(r).ID)
	if err != nil {
		writeServerError(w, "listando projetos", err)
		return
	}
	out := make([]projectResponse, 0, len(projects))
	for _, p := range projects {
		out = append(out, toProjectResponse(p))
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) handleCreateProject(w http.ResponseWriter, r *http.Request) {
	var req projectRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if msg := req.validate(); msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return
	}
	project, err := s.queries.CreateProject(r.Context(), sqlc.CreateProjectParams{
		UserID:      currentUser(r).ID,
		Name:        req.Name,
		Description: req.Description,
		Color:       req.Color,
	})
	if err != nil {
		writeServerError(w, "criando projeto", err)
		return
	}
	writeJSON(w, http.StatusCreated, toProjectResponse(project))
}

func (s *Server) handleUpdateProject(w http.ResponseWriter, r *http.Request) {
	id, err := pathUUID(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "identificador de projeto inválido")
		return
	}
	var req projectRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if msg := req.validate(); msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return
	}
	project, err := s.queries.UpdateProject(r.Context(), sqlc.UpdateProjectParams{
		ID:          id,
		UserID:      currentUser(r).ID,
		Name:        req.Name,
		Description: req.Description,
		Color:       req.Color,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "projeto não encontrado")
			return
		}
		writeServerError(w, "atualizando projeto", err)
		return
	}
	writeJSON(w, http.StatusOK, toProjectResponse(project))
}

func (s *Server) handleArchiveProject(w http.ResponseWriter, r *http.Request) {
	id, err := pathUUID(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "identificador de projeto inválido")
		return
	}
	var req struct {
		Archived bool `json:"archived"`
	}
	if !decodeJSON(w, r, &req) {
		return
	}
	project, err := s.queries.SetProjectArchived(r.Context(), sqlc.SetProjectArchivedParams{
		ID:       id,
		UserID:   currentUser(r).ID,
		Archived: req.Archived,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "projeto não encontrado")
			return
		}
		writeServerError(w, "arquivando projeto", err)
		return
	}
	writeJSON(w, http.StatusOK, toProjectResponse(project))
}

func (s *Server) handleDeleteProject(w http.ResponseWriter, r *http.Request) {
	id, err := pathUUID(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "identificador de projeto inválido")
		return
	}
	rows, err := s.queries.DeleteProject(r.Context(), sqlc.DeleteProjectParams{
		ID:     id,
		UserID: currentUser(r).ID,
	})
	if err != nil {
		writeServerError(w, "excluindo projeto", err)
		return
	}
	if rows == 0 {
		writeError(w, http.StatusNotFound, "projeto não encontrado")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
