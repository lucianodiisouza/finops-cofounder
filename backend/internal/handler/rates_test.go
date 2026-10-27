package handler

import (
	"net/http"
	"testing"
)

func TestRateUpsertAndList(t *testing.T) {
	c := newTestServer(t)
	c.login()

	var created rateResponse
	c.decode(http.MethodPut, "/api/rates",
		map[string]any{"currency": "USD", "month": "2026-10", "rate": 5.42},
		http.StatusOK, &created)
	if created.Currency != "USD" || created.Month != "2026-10" || created.Rate != 5.42 {
		t.Fatalf("cotação criada = %+v", created)
	}

	// O mesmo mês e moeda substituem o valor em vez de duplicar.
	var updated rateResponse
	c.decode(http.MethodPut, "/api/rates",
		map[string]any{"currency": "USD", "month": "2026-10", "rate": 5.5},
		http.StatusOK, &updated)
	if updated.ID != created.ID || updated.Rate != 5.5 {
		t.Errorf("cotação atualizada = %+v, quero o mesmo id com taxa 5.5", updated)
	}

	var list []rateResponse
	c.decode(http.MethodGet, "/api/rates", nil, http.StatusOK, &list)
	if len(list) != 1 {
		t.Fatalf("len(cotações) = %d, quero 1", len(list))
	}

	if status, _ := c.do(http.MethodDelete, "/api/rates/"+created.ID, nil); status != http.StatusNoContent {
		t.Errorf("exclusão = %d, quero 204", status)
	}
	c.decode(http.MethodGet, "/api/rates", nil, http.StatusOK, &list)
	if len(list) != 0 {
		t.Errorf("len(cotações) após exclusão = %d, quero 0", len(list))
	}
}

func TestRateValidation(t *testing.T) {
	c := newTestServer(t)
	c.login()

	tests := []struct {
		name string
		body map[string]any
	}{
		{"BRL não aceita cotação", map[string]any{"currency": "BRL", "month": "2026-10", "rate": 1}},
		{"moeda desconhecida", map[string]any{"currency": "JPY", "month": "2026-10", "rate": 0.04}},
		{"mês inválido", map[string]any{"currency": "USD", "month": "2026-13", "rate": 5.42}},
		{"mês com dia", map[string]any{"currency": "USD", "month": "2026-10-01", "rate": 5.42}},
		{"cotação zero", map[string]any{"currency": "USD", "month": "2026-10", "rate": 0}},
		{"cotação negativa", map[string]any{"currency": "USD", "month": "2026-10", "rate": -5}},
		{"cotação absurda", map[string]any{"currency": "USD", "month": "2026-10", "rate": 999999}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if status, _ := c.do(http.MethodPut, "/api/rates", tt.body); status != http.StatusBadRequest {
				t.Errorf("status = %d, quero 400", status)
			}
		})
	}
}

func TestRateIsolationBetweenUsers(t *testing.T) {
	owner := newTestServer(t)
	owner.login()
	var created rateResponse
	owner.decode(http.MethodPut, "/api/rates",
		map[string]any{"currency": "USD", "month": "2026-10", "rate": 5.42},
		http.StatusOK, &created)

	intruder := newTestServer(t)
	intruder.login()

	var list []rateResponse
	intruder.decode(http.MethodGet, "/api/rates", nil, http.StatusOK, &list)
	if len(list) != 0 {
		t.Errorf("o intruso vê %d cotações, quero 0", len(list))
	}
	if status, _ := intruder.do(http.MethodDelete, "/api/rates/"+created.ID, nil); status != http.StatusNotFound {
		t.Errorf("exclusão por outro usuário = %d, quero 404", status)
	}
}
