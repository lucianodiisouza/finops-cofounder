package handler

import (
	"net/http"
	"testing"
)

// seedProjects monta um cenário com dois projetos, serviços em três moedas e
// cotações cadastradas, reproduzindo o uso real da ferramenta.
func seedProjects(c *client) (string, string) {
	lojaID := c.newProject("Loja Online")
	appID := c.newProject("App de Receitas")

	c.decode(http.MethodPut, "/api/rates",
		map[string]any{"currency": "USD", "month": "2026-10", "rate": 5.42}, http.StatusOK, nil)
	c.decode(http.MethodPut, "/api/rates",
		map[string]any{"currency": "EUR", "month": "2026-10", "rate": 5.88}, http.StatusOK, nil)

	// Loja: R$ 79,00 por mês + domínio de R$ 40,00 por ano (R$ 3,33 por mês).
	c.decode(http.MethodPost, "/api/projects/"+lojaID+"/services", servicePayload(map[string]any{
		"name": "Postgres", "category": "banco", "amount_cents": 7900, "currency": "BRL",
		"billing_cycle": "monthly", "starts_on": "2025-01-01",
	}), http.StatusCreated, nil)
	c.decode(http.MethodPost, "/api/projects/"+lojaID+"/services", servicePayload(map[string]any{
		"name": "Domínio", "category": "dominio", "amount_cents": 4000, "currency": "BRL",
		"billing_cycle": "yearly", "starts_on": "2025-01-01",
	}), http.StatusCreated, nil)
	// App: US$ 25,00 por mês = R$ 135,50 com a cotação de 5,42.
	c.decode(http.MethodPost, "/api/projects/"+appID+"/services", servicePayload(map[string]any{
		"name": "Supabase", "category": "banco", "amount_cents": 2500, "currency": "USD",
		"billing_cycle": "monthly", "starts_on": "2025-01-01",
	}), http.StatusCreated, nil)

	return lojaID, appID
}

func TestDashboardTotals(t *testing.T) {
	c := newTestServer(t)
	c.login()
	_, appID := seedProjects(c)

	var dashboard dashboardResponse
	c.decode(http.MethodGet, "/api/dashboard?month=2026-10", nil, http.StatusOK, &dashboard)

	if dashboard.Month != "2026-10" {
		t.Errorf("mês = %q, quero \"2026-10\"", dashboard.Month)
	}
	// 7900 + 333 + 13550
	if want := int64(21783); dashboard.TotalCents != want {
		t.Errorf("TotalCents = %d, quero %d", dashboard.TotalCents, want)
	}
	if len(dashboard.Projects) != 2 {
		t.Fatalf("len(Projects) = %d, quero 2", len(dashboard.Projects))
	}
	// O projeto mais caro vem primeiro.
	if dashboard.Projects[0].ProjectID != appID {
		t.Errorf("primeiro projeto = %q, quero o mais caro (%q)", dashboard.Projects[0].ProjectID, appID)
	}
	if share := dashboard.Projects[0].SharePercent; share < 62 || share > 63 {
		t.Errorf("participação do primeiro projeto = %.2f%%, quero ~62,2%%", share)
	}
	if len(dashboard.MissingCurrencies) != 0 {
		t.Errorf("MissingCurrencies = %v, quero vazio", dashboard.MissingCurrencies)
	}
}

func TestDashboardDeltaAgainstPreviousMonth(t *testing.T) {
	c := newTestServer(t)
	c.login()
	projectID := c.newProject("Blog")

	// Serviço que só começa em outubro: setembro fica zerado.
	c.decode(http.MethodPost, "/api/projects/"+projectID+"/services", servicePayload(map[string]any{
		"name": "Hospedagem", "category": "servidor", "amount_cents": 2490, "currency": "BRL",
		"billing_cycle": "monthly", "starts_on": "2026-10-01",
	}), http.StatusCreated, nil)

	var october dashboardResponse
	c.decode(http.MethodGet, "/api/dashboard?month=2026-10", nil, http.StatusOK, &october)
	if october.TotalCents != 2490 || october.PreviousTotalCents != 0 || october.DeltaCents != 2490 {
		t.Errorf("outubro = %+v, quero total 2490 e variação 2490 sobre zero", october)
	}
	// Sem base no mês anterior, a variação percentual não é calculada.
	if october.DeltaPercent != nil {
		t.Errorf("DeltaPercent = %v, quero nulo quando o mês anterior é zero", *october.DeltaPercent)
	}

	// Em novembro já existe base de comparação: mesmo valor, variação zero.
	var november dashboardResponse
	c.decode(http.MethodGet, "/api/dashboard?month=2026-11", nil, http.StatusOK, &november)
	if november.PreviousTotalCents != 2490 || november.DeltaCents != 0 {
		t.Errorf("novembro = %+v, quero base 2490 e variação zero", november)
	}
	if november.DeltaPercent == nil || *november.DeltaPercent != 0 {
		t.Errorf("DeltaPercent = %v, quero 0", november.DeltaPercent)
	}
}

func TestDashboardFlagsMissingRate(t *testing.T) {
	c := newTestServer(t)
	c.login()
	projectID := c.newProject("App")

	// Serviço em dólar sem nenhuma cotação cadastrada.
	c.decode(http.MethodPost, "/api/projects/"+projectID+"/services", servicePayload(map[string]any{
		"name": "OpenAI", "category": "api", "amount_cents": 4800, "currency": "USD",
		"billing_cycle": "monthly", "starts_on": "2025-01-01",
	}), http.StatusCreated, nil)

	var dashboard dashboardResponse
	c.decode(http.MethodGet, "/api/dashboard?month=2026-10", nil, http.StatusOK, &dashboard)

	if dashboard.TotalCents != 0 {
		t.Errorf("TotalCents = %d, quero 0 enquanto a cotação está pendente", dashboard.TotalCents)
	}
	if len(dashboard.MissingCurrencies) != 1 || dashboard.MissingCurrencies[0] != "USD" {
		t.Errorf("MissingCurrencies = %v, quero [USD]", dashboard.MissingCurrencies)
	}
	if len(dashboard.Projects) != 1 || !dashboard.Projects[0].MissingRate {
		t.Errorf("o projeto deveria aparecer marcado com cotação pendente: %+v", dashboard.Projects)
	}
}

func TestDashboardExcludesArchivedProjects(t *testing.T) {
	c := newTestServer(t)
	c.login()
	lojaID, _ := seedProjects(c)

	c.decode(http.MethodPost, "/api/projects/"+lojaID+"/archive",
		map[string]bool{"archived": true}, http.StatusOK, nil)

	var dashboard dashboardResponse
	c.decode(http.MethodGet, "/api/dashboard?month=2026-10", nil, http.StatusOK, &dashboard)

	if want := int64(13550); dashboard.TotalCents != want {
		t.Errorf("TotalCents = %d, quero %d (sem o projeto arquivado)", dashboard.TotalCents, want)
	}
	if len(dashboard.Projects) != 1 {
		t.Errorf("len(Projects) = %d, quero 1", len(dashboard.Projects))
	}
}

func TestDashboardRejectsInvalidMonth(t *testing.T) {
	c := newTestServer(t)
	c.login()
	for _, month := range []string{"2026-13", "outubro", "2026"} {
		if status, _ := c.do(http.MethodGet, "/api/dashboard?month="+month, nil); status != http.StatusBadRequest {
			t.Errorf("mês %q = status %d, quero 400", month, status)
		}
	}
}

func TestProjectSummary(t *testing.T) {
	c := newTestServer(t)
	c.login()
	lojaID, _ := seedProjects(c)

	var summary projectSummaryResponse
	c.decode(http.MethodGet, "/api/projects/"+lojaID+"/summary?month=2026-10", nil, http.StatusOK, &summary)

	if summary.Project.Name != "Loja Online" {
		t.Errorf("projeto = %q, quero \"Loja Online\"", summary.Project.Name)
	}
	if want := int64(8233); summary.TotalCents != want {
		t.Errorf("TotalCents = %d, quero %d", summary.TotalCents, want)
	}
	if len(summary.Services) != 2 {
		t.Fatalf("len(Services) = %d, quero 2", len(summary.Services))
	}
	// Categorias ordenadas da mais cara para a mais barata.
	if len(summary.Categories) != 2 || summary.Categories[0].Category != "banco" {
		t.Errorf("Categories = %+v, quero banco primeiro", summary.Categories)
	}
	if len(summary.Evolution) != 12 {
		t.Errorf("len(Evolution) = %d, quero 12 meses", len(summary.Evolution))
	}
	// O domínio é anual: o resumo mostra o valor mensal rateado.
	for _, service := range summary.Services {
		if service.Name == "Domínio" && service.OriginalCents != 333 {
			t.Errorf("valor mensal do domínio = %d, quero 333", service.OriginalCents)
		}
	}
}

func TestEvolution(t *testing.T) {
	c := newTestServer(t)
	c.login()
	projectID := c.newProject("Blog")

	c.decode(http.MethodPost, "/api/projects/"+projectID+"/services", servicePayload(map[string]any{
		"name": "Hospedagem", "category": "servidor", "amount_cents": 2490, "currency": "BRL",
		"billing_cycle": "monthly", "starts_on": "2026-09-01", "ends_on": "2026-10-31",
	}), http.StatusCreated, nil)

	var body struct {
		Months []evolutionPoint `json:"months"`
	}
	c.decode(http.MethodGet, "/api/evolution?month=2026-11&months=4", nil, http.StatusOK, &body)

	if len(body.Months) != 4 {
		t.Fatalf("len(months) = %d, quero 4", len(body.Months))
	}
	want := map[string]int64{"2026-08": 0, "2026-09": 2490, "2026-10": 2490, "2026-11": 0}
	for _, point := range body.Months {
		if expected, ok := want[point.Month]; !ok {
			t.Errorf("mês inesperado na série: %s", point.Month)
		} else if point.TotalCents != expected {
			t.Errorf("total de %s = %d, quero %d", point.Month, point.TotalCents, expected)
		}
	}
}

func TestEvolutionRejectsInvalidWindow(t *testing.T) {
	c := newTestServer(t)
	c.login()
	for _, months := range []string{"0", "-3", "61", "muitos"} {
		if status, _ := c.do(http.MethodGet, "/api/evolution?months="+months, nil); status != http.StatusBadRequest {
			t.Errorf("months=%q = status %d, quero 400", months, status)
		}
	}
}
