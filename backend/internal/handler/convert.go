package handler

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/lucianodiisouza/finops-cofounder/backend/internal/costing"
	"github.com/lucianodiisouza/finops-cofounder/backend/internal/database/sqlc"
)

// dateLayout é o formato de data usado na API (ISO, fácil de consumir no frontend).
const dateLayout = "2006-01-02"

func timestamptz(t time.Time) pgtype.Timestamptz {
	return pgtype.Timestamptz{Time: t, Valid: true}
}

// toCostingService traduz uma linha do banco para o modelo do cálculo.
func toCostingService(row sqlc.ListServicesForUserRow) costing.Service {
	svc := costing.Service{
		ID:           row.ID,
		ProjectID:    row.ProjectID,
		ProjectName:  row.ProjectName,
		ProjectColor: row.ProjectColor,
		Name:         row.Name,
		Category:     row.Category,
		AmountCents:  row.AmountCents,
		Currency:     row.Currency,
		BillingCycle: row.BillingCycle,
		StartsOn:     costing.NewDate(row.StartsOn),
	}
	if row.EndsOn != nil {
		end := costing.NewDate(*row.EndsOn)
		svc.EndsOn = &end
	}
	return svc
}

// toCostingRates traduz as cotações do banco para o modelo do cálculo.
func toCostingRates(rows []sqlc.ExchangeRate) []costing.Rate {
	out := make([]costing.Rate, 0, len(rows))
	for _, r := range rows {
		out = append(out, costing.Rate{
			Currency: r.Currency,
			Month:    costing.NewMonth(r.Month),
			RateE8:   r.RateE8,
		})
	}
	return out
}

// loadCostingInputs busca tudo que o cálculo precisa: serviços ativos e cotações.
// Serviços de projetos arquivados ficam de fora do cálculo.
func (s *Server) loadCostingInputs(ctx context.Context, userID uuid.UUID) ([]costing.Service, *costing.RateTable, error) {
	rows, err := s.queries.ListServicesForUser(ctx, userID)
	if err != nil {
		return nil, nil, err
	}
	services := make([]costing.Service, 0, len(rows))
	for _, row := range rows {
		if row.ProjectArchivedAt.Valid {
			continue
		}
		services = append(services, toCostingService(row))
	}
	rateRows, err := s.queries.ListExchangeRates(ctx, userID)
	if err != nil {
		return nil, nil, err
	}
	return services, costing.NewRateTable(toCostingRates(rateRows)), nil
}
