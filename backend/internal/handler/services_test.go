package handler

import (
	"net/http"
	"testing"
)

func servicePayload(overrides map[string]any) map[string]any {
	payload := map[string]any{
		"name":          "VPS Hetzner",
		"category":      "servidor",
		"amount_cents":  1290,
		"currency":      "EUR",
		"billing_cycle": "monthly",
		"starts_on":     "2026-01-01",
		"ends_on":       nil,
		"notes":         "conta pessoal",
	}
	for key, value := range overrides {
		payload[key] = value
	}
	return payload
}

func TestServiceCRUD(t *testing.T) {
	c := newTestServer(t)
	c.login()
	projectID := c.newProject("Loja Online")

	var created serviceResponse
	c.decode(http.MethodPost, "/api/projects/"+projectID+"/services",
		servicePayload(nil), http.StatusCreated, &created)
	if created.Name != "VPS Hetzner" || created.AmountCents != 1290 || created.Currency != "EUR" {
		t.Fatalf("serviço criado = %+v", created)
	}
	if created.StartsOn != "2026-01-01" || created.EndsOn != nil {
		t.Errorf("datas do serviço = (%s, %v), quero (2026-01-01, nil)", created.StartsOn, created.EndsOn)
	}

	var updated serviceResponse
	c.decode(http.MethodPut, "/api/services/"+created.ID,
		servicePayload(map[string]any{
			"name": "VPS Hetzner CX32", "amount_cents": 2390, "ends_on": "2026-12-31",
		}), http.StatusOK, &updated)
	if updated.AmountCents != 2390 || updated.EndsOn == nil || *updated.EndsOn != "2026-12-31" {
		t.Errorf("serviço atualizado = %+v", updated)
	}

	if status, _ := c.do(http.MethodDelete, "/api/services/"+created.ID, nil); status != http.StatusNoContent {
		t.Errorf("exclusão = %d, quero 204", status)
	}
	if status, _ := c.do(http.MethodDelete, "/api/services/"+created.ID, nil); status != http.StatusNotFound {
		t.Errorf("segunda exclusão = %d, quero 404", status)
	}
}

func TestServiceValidation(t *testing.T) {
	c := newTestServer(t)
	c.login()
	projectID := c.newProject("Loja Online")

	tests := []struct {
		name      string
		overrides map[string]any
	}{
		{"nome vazio", map[string]any{"name": ""}},
		{"categoria inválida", map[string]any{"category": "foguete"}},
		{"moeda inválida", map[string]any{"currency": "JPY"}},
		{"ciclo inválido", map[string]any{"billing_cycle": "semanal"}},
		{"valor negativo", map[string]any{"amount_cents": -100}},
		{"valor absurdo", map[string]any{"amount_cents": 99_999_999_999}},
		{"data de início inválida", map[string]any{"starts_on": "01/01/2026"}},
		{"data de início ausente", map[string]any{"starts_on": ""}},
		{"término antes do início", map[string]any{"starts_on": "2026-05-01", "ends_on": "2026-04-01"}},
		{"data de término inválida", map[string]any{"ends_on": "amanhã"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			status, _ := c.do(http.MethodPost, "/api/projects/"+projectID+"/services",
				servicePayload(tt.overrides))
			if status != http.StatusBadRequest {
				t.Errorf("status = %d, quero 400", status)
			}
		})
	}
}

func TestServiceNormalizesCaseAndWhitespace(t *testing.T) {
	c := newTestServer(t)
	c.login()
	projectID := c.newProject("Loja Online")

	var created serviceResponse
	c.decode(http.MethodPost, "/api/projects/"+projectID+"/services",
		servicePayload(map[string]any{
			"name": "  Domínio  ", "category": "DOMINIO", "currency": "usd", "billing_cycle": "YEARLY",
		}), http.StatusCreated, &created)

	if created.Name != "Domínio" {
		t.Errorf("nome = %q, quero \"Domínio\" sem espaços nas pontas", created.Name)
	}
	if created.Category != "dominio" || created.Currency != "USD" || created.BillingCycle != "yearly" {
		t.Errorf("campos normalizados = (%s, %s, %s)", created.Category, created.Currency, created.BillingCycle)
	}
}

// TestServiceIsolationBetweenUsers garante que o serviço de um usuário não é
// editável nem excluível por outro.
func TestServiceIsolationBetweenUsers(t *testing.T) {
	owner := newTestServer(t)
	owner.login()
	projectID := owner.newProject("Projeto do dono")

	var created serviceResponse
	owner.decode(http.MethodPost, "/api/projects/"+projectID+"/services",
		servicePayload(nil), http.StatusCreated, &created)

	intruder := newTestServer(t)
	intruder.login()

	if status, _ := intruder.do(http.MethodPut, "/api/services/"+created.ID,
		servicePayload(map[string]any{"name": "Invadido"})); status != http.StatusNotFound {
		t.Errorf("edição por outro usuário = %d, quero 404", status)
	}
	if status, _ := intruder.do(http.MethodDelete, "/api/services/"+created.ID, nil); status != http.StatusNotFound {
		t.Errorf("exclusão por outro usuário = %d, quero 404", status)
	}
}
