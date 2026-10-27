package handler

import (
	"math"
	"net/http"
	"strings"

	"github.com/lucianodiisouza/finops-cofounder/backend/internal/costing"
	"github.com/lucianodiisouza/finops-cofounder/backend/internal/database/sqlc"
)

// rateScale é o fator de escala das cotações armazenadas (ver ADR 001).
const rateScale = 100_000_000.0

// maxRate limita a cotação a um valor claramente fora da realidade, pegando erros de digitação.
const maxRate = 10_000.0

type rateResponse struct {
	ID       string  `json:"id"`
	Currency string  `json:"currency"`
	Month    string  `json:"month"`
	Rate     float64 `json:"rate"`
}

func toRateResponse(r sqlc.ExchangeRate) rateResponse {
	return rateResponse{
		ID:       r.ID.String(),
		Currency: r.Currency,
		Month:    costing.NewMonth(r.Month).String(),
		Rate:     float64(r.RateE8) / rateScale,
	}
}

func (s *Server) handleListRates(w http.ResponseWriter, r *http.Request) {
	rates, err := s.queries.ListExchangeRates(r.Context(), currentUser(r).ID)
	if err != nil {
		writeServerError(w, "listando cotações", err)
		return
	}
	out := make([]rateResponse, 0, len(rates))
	for _, rate := range rates {
		out = append(out, toRateResponse(rate))
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) handleUpsertRate(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Currency string  `json:"currency"`
		Month    string  `json:"month"`
		Rate     float64 `json:"rate"`
	}
	if !decodeJSON(w, r, &req) {
		return
	}
	currency := strings.ToUpper(strings.TrimSpace(req.Currency))
	if currency != costing.CurrencyUSD && currency != costing.CurrencyEUR {
		writeError(w, http.StatusBadRequest, "cotação só se aplica a USD e EUR")
		return
	}
	month, err := costing.ParseMonth(strings.TrimSpace(req.Month))
	if err != nil {
		writeError(w, http.StatusBadRequest, "mês inválido: use o formato AAAA-MM")
		return
	}
	if req.Rate <= 0 || req.Rate > maxRate || math.IsNaN(req.Rate) || math.IsInf(req.Rate, 0) {
		writeError(w, http.StatusBadRequest, "informe uma cotação maior que zero")
		return
	}

	rate, err := s.queries.UpsertExchangeRate(r.Context(), sqlc.UpsertExchangeRateParams{
		UserID:   currentUser(r).ID,
		Currency: currency,
		Month:    month.FirstDay(),
		RateE8:   int64(math.Round(req.Rate * rateScale)),
	})
	if err != nil {
		writeServerError(w, "salvando cotação", err)
		return
	}
	writeJSON(w, http.StatusOK, toRateResponse(rate))
}

func (s *Server) handleDeleteRate(w http.ResponseWriter, r *http.Request) {
	id, err := pathUUID(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "identificador de cotação inválido")
		return
	}
	rows, err := s.queries.DeleteExchangeRate(r.Context(), sqlc.DeleteExchangeRateParams{
		ID:     id,
		UserID: currentUser(r).ID,
	})
	if err != nil {
		writeServerError(w, "excluindo cotação", err)
		return
	}
	if rows == 0 {
		writeError(w, http.StatusNotFound, "cotação não encontrada")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
