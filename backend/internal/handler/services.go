package handler

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/lucianodiisouza/finops-cofounder/backend/internal/costing"
	"github.com/lucianodiisouza/finops-cofounder/backend/internal/database/sqlc"
)

// categories são as categorias aceitas para um serviço.
var categories = map[string]bool{
	"servidor":       true,
	"banco":          true,
	"dominio":        true,
	"api":            true,
	"armazenamento":  true,
	"monitoramento":  true,
	"outro":          true,
}

var currencies = map[string]bool{
	costing.CurrencyBRL: true,
	costing.CurrencyUSD: true,
	costing.CurrencyEUR: true,
}

var cycles = map[string]bool{
	costing.CycleMonthly: true,
	costing.CycleYearly:  true,
}

// maxAmountCents limita o valor de um serviço a R$ 100 milhões, o que descarta
// digitação acidental de valores absurdos sem atrapalhar uso real.
const maxAmountCents int64 = 10_000_000_000

type serviceResponse struct {
	ID           string  `json:"id"`
	ProjectID    string  `json:"project_id"`
	Name         string  `json:"name"`
	Category     string  `json:"category"`
	AmountCents  int64   `json:"amount_cents"`
	Currency     string  `json:"currency"`
	BillingCycle string  `json:"billing_cycle"`
	StartsOn     string  `json:"starts_on"`
	EndsOn       *string `json:"ends_on"`
	Notes        string  `json:"notes"`
}

func toServiceResponse(s sqlc.Service) serviceResponse {
	out := serviceResponse{
		ID:           s.ID.String(),
		ProjectID:    s.ProjectID.String(),
		Name:         s.Name,
		Category:     s.Category,
		AmountCents:  s.AmountCents,
		Currency:     s.Currency,
		BillingCycle: s.BillingCycle,
		StartsOn:     s.StartsOn.Format(dateLayout),
		Notes:        s.Notes,
	}
	if s.EndsOn != nil {
		ends := s.EndsOn.Format(dateLayout)
		out.EndsOn = &ends
	}
	return out
}

type serviceRequest struct {
	Name         string  `json:"name"`
	Category     string  `json:"category"`
	AmountCents  int64   `json:"amount_cents"`
	Currency     string  `json:"currency"`
	BillingCycle string  `json:"billing_cycle"`
	StartsOn     string  `json:"starts_on"`
	EndsOn       *string `json:"ends_on"`
	Notes        string  `json:"notes"`

	startsOn time.Time
	endsOn   *time.Time
}

// validate normaliza e valida os campos do serviço, preenchendo as datas parseadas.
func (req *serviceRequest) validate() string {
	req.Name = strings.TrimSpace(req.Name)
	req.Notes = strings.TrimSpace(req.Notes)
	req.Category = strings.ToLower(strings.TrimSpace(req.Category))
	req.Currency = strings.ToUpper(strings.TrimSpace(req.Currency))
	req.BillingCycle = strings.ToLower(strings.TrimSpace(req.BillingCycle))

	if req.Name == "" {
		return "o nome do serviço é obrigatório"
	}
	if len(req.Name) > maxNameLength {
		return "o nome do serviço é muito longo"
	}
	if !categories[req.Category] {
		return "categoria inválida"
	}
	if !currencies[req.Currency] {
		return "moeda inválida: use BRL, USD ou EUR"
	}
	if !cycles[req.BillingCycle] {
		return "ciclo de cobrança inválido: use mensal ou anual"
	}
	if req.AmountCents < 0 {
		return "o valor não pode ser negativo"
	}
	if req.AmountCents > maxAmountCents {
		return "o valor informado é muito alto"
	}

	start, err := time.Parse(dateLayout, strings.TrimSpace(req.StartsOn))
	if err != nil {
		return "data de início inválida"
	}
	req.startsOn = start

	req.endsOn = nil
	if req.EndsOn != nil && strings.TrimSpace(*req.EndsOn) != "" {
		end, err := time.Parse(dateLayout, strings.TrimSpace(*req.EndsOn))
		if err != nil {
			return "data de término inválida"
		}
		if end.Before(start) {
			return "a data de término não pode ser anterior à data de início"
		}
		req.endsOn = &end
	}
	return ""
}

func (s *Server) handleCreateService(w http.ResponseWriter, r *http.Request) {
	projectID, err := pathUUID(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "identificador de projeto inválido")
		return
	}
	var req serviceRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if msg := req.validate(); msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return
	}
	service, err := s.queries.CreateService(r.Context(), sqlc.CreateServiceParams{
		ProjectID:    projectID,
		UserID:       currentUser(r).ID,
		Name:         req.Name,
		Category:     req.Category,
		AmountCents:  req.AmountCents,
		Currency:     req.Currency,
		BillingCycle: req.BillingCycle,
		StartsOn:     req.startsOn,
		EndsOn:       req.endsOn,
		Notes:        req.Notes,
	})
	if err != nil {
		// Sem linhas significa que o projeto não existe ou não pertence ao usuário.
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "projeto não encontrado")
			return
		}
		writeServerError(w, "criando serviço", err)
		return
	}
	writeJSON(w, http.StatusCreated, toServiceResponse(service))
}

func (s *Server) handleUpdateService(w http.ResponseWriter, r *http.Request) {
	id, err := pathUUID(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "identificador de serviço inválido")
		return
	}
	var req serviceRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if msg := req.validate(); msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return
	}
	service, err := s.queries.UpdateService(r.Context(), sqlc.UpdateServiceParams{
		ID:           id,
		UserID:       currentUser(r).ID,
		Name:         req.Name,
		Category:     req.Category,
		AmountCents:  req.AmountCents,
		Currency:     req.Currency,
		BillingCycle: req.BillingCycle,
		StartsOn:     req.startsOn,
		EndsOn:       req.endsOn,
		Notes:        req.Notes,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "serviço não encontrado")
			return
		}
		writeServerError(w, "atualizando serviço", err)
		return
	}
	writeJSON(w, http.StatusOK, toServiceResponse(service))
}

func (s *Server) handleDeleteService(w http.ResponseWriter, r *http.Request) {
	id, err := pathUUID(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "identificador de serviço inválido")
		return
	}
	rows, err := s.queries.DeleteService(r.Context(), sqlc.DeleteServiceParams{
		ID:     id,
		UserID: currentUser(r).ID,
	})
	if err != nil {
		writeServerError(w, "excluindo serviço", err)
		return
	}
	if rows == 0 {
		writeError(w, http.StatusNotFound, "serviço não encontrado")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
