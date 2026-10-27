// Package costing calcula os custos mensais dos projetos a partir dos serviços
// cadastrados e das cotações de câmbio. É um pacote puro — sem banco de dados —
// para que as regras de negócio possam ser testadas isoladamente.
package costing

import (
	"fmt"
	"time"
)

// Month representa um mês de competência (ano + mês, sem dia).
type Month struct {
	Year  int
	Month time.Month
}

// NewMonth normaliza uma data para o mês de competência correspondente.
func NewMonth(t time.Time) Month {
	return Month{Year: t.Year(), Month: t.Month()}
}

// ParseMonth interpreta uma string "YYYY-MM".
func ParseMonth(s string) (Month, error) {
	t, err := time.Parse("2006-01", s)
	if err != nil {
		return Month{}, fmt.Errorf("mês inválido %q: use o formato YYYY-MM", s)
	}
	return NewMonth(t), nil
}

// String devolve o mês no formato "YYYY-MM".
func (m Month) String() string {
	return fmt.Sprintf("%04d-%02d", m.Year, int(m.Month))
}

// FirstDay devolve o primeiro dia do mês (UTC).
func (m Month) FirstDay() time.Time {
	return time.Date(m.Year, m.Month, 1, 0, 0, 0, 0, time.UTC)
}

// LastDay devolve o último dia do mês (UTC).
func (m Month) LastDay() time.Time {
	return m.FirstDay().AddDate(0, 1, -1)
}

// Add desloca o mês em n meses (n pode ser negativo).
func (m Month) Add(n int) Month {
	return NewMonth(m.FirstDay().AddDate(0, n, 0))
}

// Before informa se m é anterior a other.
func (m Month) Before(other Month) bool {
	return m.FirstDay().Before(other.FirstDay())
}

// Range devolve os `count` meses terminando em m (inclusive), em ordem crescente.
func Range(end Month, count int) []Month {
	if count <= 0 {
		return nil
	}
	months := make([]Month, 0, count)
	for i := count - 1; i >= 0; i-- {
		months = append(months, end.Add(-i))
	}
	return months
}
