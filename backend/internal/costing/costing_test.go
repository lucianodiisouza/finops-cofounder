package costing

import (
	"testing"
	"time"

	"github.com/google/uuid"
)

func date(s string) Date {
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		panic(err)
	}
	return NewDate(t)
}

func datePtr(s string) *Date {
	d := date(s)
	return &d
}

func month(s string) Month {
	m, err := ParseMonth(s)
	if err != nil {
		panic(err)
	}
	return m
}

func TestMonthlyAmountCents(t *testing.T) {
	tests := []struct {
		name  string
		input Service
		want  int64
	}{
		{"mensal usa o valor cheio", Service{AmountCents: 7900, BillingCycle: CycleMonthly}, 7900},
		{"anual é rateado por 12", Service{AmountCents: 12000, BillingCycle: CycleYearly}, 1000},
		{"anual arredonda para cima na metade", Service{AmountCents: 4000, BillingCycle: CycleYearly}, 333},
		{"anual com resto grande arredonda para cima", Service{AmountCents: 11900, BillingCycle: CycleYearly}, 992},
		{"valor zero", Service{AmountCents: 0, BillingCycle: CycleMonthly}, 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.input.MonthlyAmountCents(); got != tt.want {
				t.Errorf("MonthlyAmountCents() = %d, quero %d", got, tt.want)
			}
		})
	}
}

func TestServiceActiveIn(t *testing.T) {
	tests := []struct {
		name  string
		svc   Service
		month string
		want  bool
	}{
		{"vigente no mês do início", Service{StartsOn: date("2026-10-15")}, "2026-10", true},
		{"início no último dia do mês conta", Service{StartsOn: date("2026-10-31")}, "2026-10", true},
		{"início no mês seguinte não conta", Service{StartsOn: date("2026-11-01")}, "2026-10", false},
		{"mês anterior ao início não conta", Service{StartsOn: date("2026-10-01")}, "2026-09", false},
		{
			"término no meio do mês ainda conta naquele mês",
			Service{StartsOn: date("2025-01-01"), EndsOn: datePtr("2026-10-15")},
			"2026-10", true,
		},
		{
			"mês posterior ao término não conta",
			Service{StartsOn: date("2025-01-01"), EndsOn: datePtr("2026-08-31")},
			"2026-09", false,
		},
		{
			"término no primeiro dia do mês ainda conta",
			Service{StartsOn: date("2025-01-01"), EndsOn: datePtr("2026-10-01")},
			"2026-10", true,
		},
		{"sem término segue vigente", Service{StartsOn: date("2020-01-01")}, "2026-10", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.svc.ActiveIn(month(tt.month)); got != tt.want {
				t.Errorf("ActiveIn(%s) = %v, quero %v", tt.month, got, tt.want)
			}
		})
	}
}

func TestRateTableLookup(t *testing.T) {
	table := NewRateTable([]Rate{
		{Currency: "USD", Month: month("2026-09"), RateE8: 531_000_000},
		{Currency: "USD", Month: month("2026-10"), RateE8: 542_000_000},
		{Currency: "EUR", Month: month("2026-10"), RateE8: 588_000_000},
	})

	tests := []struct {
		name     string
		currency string
		month    string
		wantRate int64
		wantOK   bool
	}{
		{"BRL vale sempre 1", "BRL", "2020-01", 100_000_000, true},
		{"cotação exata do mês", "USD", "2026-10", 542_000_000, true},
		{"mês sem cotação usa a anterior", "USD", "2026-12", 542_000_000, true},
		{"mês anterior à primeira cotação não resolve", "USD", "2026-08", 0, false},
		{"moeda sem nenhuma cotação não resolve", "EUR", "2026-09", 0, false},
		{"moeda desconhecida não resolve", "GBP", "2026-10", 0, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rate, ok := table.Lookup(tt.currency, month(tt.month))
			if ok != tt.wantOK || rate != tt.wantRate {
				t.Errorf("Lookup(%s, %s) = (%d, %v), quero (%d, %v)",
					tt.currency, tt.month, rate, ok, tt.wantRate, tt.wantOK)
			}
		})
	}
}

func TestConvertCents(t *testing.T) {
	tests := []struct {
		name   string
		cents  int64
		rateE8 int64
		want   int64
	}{
		{"dólar a 5,42", 2500, 542_000_000, 13550},
		{"euro a 5,88", 1290, 588_000_000, 7585},
		{"cotação 1 não altera", 7900, 100_000_000, 7900},
		{"arredonda para o centavo mais próximo", 333, 542_000_000, 1805}, // 1804,86
		{"valor alto não estoura int64", 10_000_000_000, 542_000_000, 54_200_000_000},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := convertCents(tt.cents, tt.rateE8); got != tt.want {
				t.Errorf("convertCents(%d, %d) = %d, quero %d", tt.cents, tt.rateE8, got, tt.want)
			}
		})
	}
}

func TestComputeMonth(t *testing.T) {
	projectA, projectB := uuid.New(), uuid.New()
	services := []Service{
		{
			ID: uuid.New(), ProjectID: projectA, ProjectName: "Loja", ProjectColor: "#2a78d6",
			Name: "Postgres", Category: "banco", AmountCents: 7900, Currency: "BRL",
			BillingCycle: CycleMonthly, StartsOn: date("2025-01-01"),
		},
		{
			ID: uuid.New(), ProjectID: projectA, ProjectName: "Loja", ProjectColor: "#2a78d6",
			Name: "Domínio", Category: "dominio", AmountCents: 4000, Currency: "BRL",
			BillingCycle: CycleYearly, StartsOn: date("2025-01-01"),
		},
		{
			ID: uuid.New(), ProjectID: projectB, ProjectName: "App", ProjectColor: "#eb6834",
			Name: "Supabase", Category: "banco", AmountCents: 2500, Currency: "USD",
			BillingCycle: CycleMonthly, StartsOn: date("2025-01-01"),
		},
	}
	rates := NewRateTable([]Rate{{Currency: "USD", Month: month("2026-10"), RateE8: 542_000_000}})

	got := ComputeMonth(services, rates, month("2026-10"))

	// 7900 + 333 (anual rateado) + 13550 (25 USD a 5,42)
	if want := int64(21783); got.TotalCents != want {
		t.Errorf("TotalCents = %d, quero %d", got.TotalCents, want)
	}
	if len(got.Projects) != 2 {
		t.Fatalf("len(Projects) = %d, quero 2", len(got.Projects))
	}
	// Projeto mais caro primeiro: App (13550) acima de Loja (8233).
	if got.Projects[0].ProjectName != "App" {
		t.Errorf("primeiro projeto = %q, quero \"App\" (o mais caro)", got.Projects[0].ProjectName)
	}
	if want := int64(8233); got.Projects[1].TotalCents != want {
		t.Errorf("total de Loja = %d, quero %d", got.Projects[1].TotalCents, want)
	}
	if len(got.MissingCurrencies) != 0 {
		t.Errorf("MissingCurrencies = %v, quero vazio", got.MissingCurrencies)
	}
}

func TestComputeMonthWithoutRate(t *testing.T) {
	projectA := uuid.New()
	services := []Service{
		{
			ID: uuid.New(), ProjectID: projectA, ProjectName: "Loja",
			Name: "Postgres", AmountCents: 7900, Currency: "BRL",
			BillingCycle: CycleMonthly, StartsOn: date("2025-01-01"),
		},
		{
			ID: uuid.New(), ProjectID: projectA, ProjectName: "Loja",
			Name: "OpenAI", AmountCents: 4800, Currency: "USD",
			BillingCycle: CycleMonthly, StartsOn: date("2025-01-01"),
		},
	}
	got := ComputeMonth(services, NewRateTable(nil), month("2026-10"))

	// Sem cotação, o serviço em USD fica fora do total mas aparece na lista.
	if want := int64(7900); got.TotalCents != want {
		t.Errorf("TotalCents = %d, quero %d (o serviço em USD deve ficar fora)", got.TotalCents, want)
	}
	if len(got.MissingCurrencies) != 1 || got.MissingCurrencies[0] != "USD" {
		t.Errorf("MissingCurrencies = %v, quero [USD]", got.MissingCurrencies)
	}
	if !got.Projects[0].MissingRate {
		t.Error("o projeto deveria estar marcado com cotação pendente")
	}
	if len(got.Projects[0].Services) != 2 {
		t.Errorf("len(Services) = %d, quero 2 (o pendente também é listado)", len(got.Projects[0].Services))
	}
}

func TestComputeMonthIgnoresInactiveServices(t *testing.T) {
	services := []Service{{
		ID: uuid.New(), ProjectID: uuid.New(), ProjectName: "Blog",
		Name: "Monitoramento", AmountCents: 1900, Currency: "BRL",
		BillingCycle: CycleMonthly, StartsOn: date("2025-01-01"), EndsOn: datePtr("2026-08-31"),
	}}

	if got := ComputeMonth(services, NewRateTable(nil), month("2026-09")); got.TotalCents != 0 {
		t.Errorf("TotalCents = %d, quero 0 após o término do serviço", got.TotalCents)
	}
	if got := ComputeMonth(services, NewRateTable(nil), month("2026-08")); got.TotalCents != 1900 {
		t.Errorf("TotalCents = %d, quero 1900 no mês do término", got.TotalCents)
	}
}

func TestMonthHelpers(t *testing.T) {
	m := month("2026-10")

	if got := m.String(); got != "2026-10" {
		t.Errorf("String() = %q, quero \"2026-10\"", got)
	}
	if got := m.FirstDay().Format("2006-01-02"); got != "2026-10-01" {
		t.Errorf("FirstDay() = %s, quero 2026-10-01", got)
	}
	if got := m.LastDay().Format("2006-01-02"); got != "2026-10-31" {
		t.Errorf("LastDay() = %s, quero 2026-10-31", got)
	}
	if got := m.Add(-1).String(); got != "2026-09" {
		t.Errorf("Add(-1) = %s, quero 2026-09", got)
	}
	// Virada de ano nos dois sentidos.
	if got := m.Add(3).String(); got != "2027-01" {
		t.Errorf("Add(3) = %s, quero 2027-01", got)
	}
	if got := month("2026-01").Add(-1).String(); got != "2025-12" {
		t.Errorf("Add(-1) em janeiro = %s, quero 2025-12", got)
	}
	// Fevereiro tem 28 dias em 2026.
	if got := month("2026-02").LastDay().Format("2006-01-02"); got != "2026-02-28" {
		t.Errorf("LastDay() de fevereiro = %s, quero 2026-02-28", got)
	}
}

func TestParseMonthRejectsInvalidInput(t *testing.T) {
	for _, input := range []string{"", "2026", "2026-13", "outubro", "2026-10-01"} {
		if _, err := ParseMonth(input); err == nil {
			t.Errorf("ParseMonth(%q) não devolveu erro", input)
		}
	}
}

func TestRange(t *testing.T) {
	got := Range(month("2026-01"), 3)
	want := []string{"2025-11", "2025-12", "2026-01"}
	if len(got) != len(want) {
		t.Fatalf("len(Range) = %d, quero %d", len(got), len(want))
	}
	for i, m := range got {
		if m.String() != want[i] {
			t.Errorf("Range()[%d] = %s, quero %s", i, m.String(), want[i])
		}
	}
	if Range(month("2026-01"), 0) != nil {
		t.Error("Range com contagem zero deveria ser nil")
	}
}
