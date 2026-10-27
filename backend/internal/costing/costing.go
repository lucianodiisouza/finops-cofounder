package costing

import (
	"math/big"
	"sort"

	"github.com/google/uuid"
)

// Moedas aceitas pelo sistema.
const (
	CurrencyBRL = "BRL"
	CurrencyUSD = "USD"
	CurrencyEUR = "EUR"
)

// Ciclos de cobrança aceitos.
const (
	CycleMonthly = "monthly"
	CycleYearly  = "yearly"
)

// rateScale é o fator de escala das cotações: rate_e8 = cotação × 10^8 (ver ADR 001).
const rateScale = 100_000_000

// Service é a visão que o cálculo precisa de um serviço cadastrado.
type Service struct {
	ID           uuid.UUID
	ProjectID    uuid.UUID
	ProjectName  string
	ProjectColor string
	Name         string
	Category     string
	AmountCents  int64
	Currency     string
	BillingCycle string
	StartsOn     Date
	EndsOn       *Date
}

// Rate é uma cotação de câmbio para um mês de competência.
type Rate struct {
	Currency string
	Month    Month
	RateE8   int64
}

// MonthlyAmountCents devolve o custo mensal do serviço na moeda em que foi cadastrado.
// Valores anuais são rateados por 12, arredondando para o centavo mais próximo.
func (s Service) MonthlyAmountCents() int64 {
	if s.BillingCycle == CycleYearly {
		return divRound(s.AmountCents, 12)
	}
	return s.AmountCents
}

// ActiveIn informa se o serviço estava vigente em algum momento do mês.
func (s Service) ActiveIn(m Month) bool {
	if s.StartsOn.After(NewDate(m.LastDay())) {
		return false
	}
	if s.EndsOn != nil && s.EndsOn.Before(NewDate(m.FirstDay())) {
		return false
	}
	return true
}

// RateTable resolve a cotação aplicável a uma moeda em um mês.
type RateTable struct {
	byCurrency map[string][]Rate // ordenado por mês crescente
}

// NewRateTable monta a tabela de consulta a partir das cotações cadastradas.
func NewRateTable(rates []Rate) *RateTable {
	t := &RateTable{byCurrency: make(map[string][]Rate)}
	for _, r := range rates {
		t.byCurrency[r.Currency] = append(t.byCurrency[r.Currency], r)
	}
	for currency := range t.byCurrency {
		list := t.byCurrency[currency]
		sort.Slice(list, func(i, j int) bool { return list[i].Month.Before(list[j].Month) })
		t.byCurrency[currency] = list
	}
	return t
}

// Lookup devolve a cotação do mês informado. Se não houver cotação para aquele mês,
// usa a mais recente de um mês anterior (ver ADR 002). Para BRL a cotação é 1.
func (t *RateTable) Lookup(currency string, m Month) (int64, bool) {
	if currency == CurrencyBRL {
		return rateScale, true
	}
	var found int64
	var ok bool
	for _, r := range t.byCurrency[currency] {
		if r.Month.Before(m) || r.Month == m {
			found, ok = r.RateE8, true
			continue
		}
		break
	}
	return found, ok
}

// ServiceCost é o custo de um serviço em um mês, com o valor original e o convertido.
type ServiceCost struct {
	Service        Service
	OriginalCents  int64 // custo mensal na moeda cadastrada
	ConvertedCents int64 // custo mensal em BRL (0 quando a cotação está pendente)
	RateE8         int64 // cotação usada (0 quando pendente)
	MissingRate    bool  // true quando não há cotação cadastrada para a moeda
}

// ProjectCost é o custo consolidado de um projeto em um mês.
type ProjectCost struct {
	ProjectID    uuid.UUID
	ProjectName  string
	ProjectColor string
	TotalCents   int64
	Services     []ServiceCost
	MissingRate  bool
}

// MonthCost é o resultado do cálculo de um mês.
type MonthCost struct {
	Month            Month
	TotalCents       int64
	Projects         []ProjectCost
	MissingCurrencies []string
}

// ComputeMonth calcula o custo de um mês a partir dos serviços e das cotações.
// Projetos sem nenhum serviço ativo no mês não aparecem no resultado.
func ComputeMonth(services []Service, rates *RateTable, m Month) MonthCost {
	result := MonthCost{Month: m}
	byProject := make(map[uuid.UUID]*ProjectCost)
	var order []uuid.UUID
	missing := make(map[string]bool)

	for _, s := range services {
		if !s.ActiveIn(m) {
			continue
		}
		pc, seen := byProject[s.ProjectID]
		if !seen {
			pc = &ProjectCost{
				ProjectID:    s.ProjectID,
				ProjectName:  s.ProjectName,
				ProjectColor: s.ProjectColor,
			}
			byProject[s.ProjectID] = pc
			order = append(order, s.ProjectID)
		}

		cost := ServiceCost{Service: s, OriginalCents: s.MonthlyAmountCents()}
		rateE8, ok := rates.Lookup(s.Currency, m)
		if !ok {
			cost.MissingRate = true
			pc.MissingRate = true
			missing[s.Currency] = true
		} else {
			cost.RateE8 = rateE8
			cost.ConvertedCents = convertCents(cost.OriginalCents, rateE8)
			pc.TotalCents += cost.ConvertedCents
			result.TotalCents += cost.ConvertedCents
		}
		pc.Services = append(pc.Services, cost)
	}

	for _, id := range order {
		result.Projects = append(result.Projects, *byProject[id])
	}
	// Projetos mais caros primeiro; empate resolvido pelo nome para estabilidade.
	sort.SliceStable(result.Projects, func(i, j int) bool {
		if result.Projects[i].TotalCents != result.Projects[j].TotalCents {
			return result.Projects[i].TotalCents > result.Projects[j].TotalCents
		}
		return result.Projects[i].ProjectName < result.Projects[j].ProjectName
	})

	for currency := range missing {
		result.MissingCurrencies = append(result.MissingCurrencies, currency)
	}
	sort.Strings(result.MissingCurrencies)
	return result
}

// ComputeMonths calcula vários meses de uma vez, na ordem informada.
func ComputeMonths(services []Service, rates *RateTable, months []Month) []MonthCost {
	out := make([]MonthCost, 0, len(months))
	for _, m := range months {
		out = append(out, ComputeMonth(services, rates, m))
	}
	return out
}

// convertCents aplica a cotação a um valor em centavos.
// Usa math/big porque centavos × cotação_e8 pode estourar int64 em valores altos.
func convertCents(cents, rateE8 int64) int64 {
	product := new(big.Int).Mul(big.NewInt(cents), big.NewInt(rateE8))
	quotient, remainder := new(big.Int).QuoRem(product, big.NewInt(rateScale), new(big.Int))
	// Arredonda para o centavo mais próximo (metade para cima, em valor absoluto).
	twice := new(big.Int).Abs(new(big.Int).Mul(remainder, big.NewInt(2)))
	if twice.Cmp(big.NewInt(rateScale)) >= 0 {
		if product.Sign() < 0 {
			quotient.Sub(quotient, big.NewInt(1))
		} else {
			quotient.Add(quotient, big.NewInt(1))
		}
	}
	return quotient.Int64()
}

// divRound divide arredondando para o inteiro mais próximo (metade para cima).
func divRound(a, b int64) int64 {
	if b == 0 {
		return 0
	}
	q := a / b
	r := a % b
	if r*2 >= b {
		q++
	}
	return q
}
