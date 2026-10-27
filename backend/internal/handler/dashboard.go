package handler

import (
	"errors"
	"net/http"
	"sort"
	"strconv"

	"github.com/jackc/pgx/v5"

	"github.com/lucianodiisouza/finops-cofounder/backend/internal/costing"
	"github.com/lucianodiisouza/finops-cofounder/backend/internal/database/sqlc"
)

// evolutionMonths é a janela padrão do gráfico de evolução.
const evolutionMonths = 12

// maxEvolutionMonths limita a janela que o cliente pode pedir.
const maxEvolutionMonths = 60

type dashboardProject struct {
	ProjectID    string  `json:"project_id"`
	Name         string  `json:"name"`
	Color        string  `json:"color"`
	TotalCents   int64   `json:"total_cents"`
	SharePercent float64 `json:"share_percent"`
	ServiceCount int     `json:"service_count"`
	MissingRate  bool    `json:"missing_rate"`
}

type dashboardResponse struct {
	Month              string             `json:"month"`
	TotalCents         int64              `json:"total_cents"`
	PreviousTotalCents int64              `json:"previous_total_cents"`
	DeltaCents         int64              `json:"delta_cents"`
	DeltaPercent       *float64           `json:"delta_percent"`
	Projects           []dashboardProject `json:"projects"`
	MissingCurrencies  []string           `json:"missing_currencies"`
}

func (s *Server) handleDashboard(w http.ResponseWriter, r *http.Request) {
	month, err := monthParam(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	services, rates, err := s.loadCostingInputs(r.Context(), currentUser(r).ID)
	if err != nil {
		writeServerError(w, "carregando dados do painel", err)
		return
	}

	current := costing.ComputeMonth(services, rates, month)
	previous := costing.ComputeMonth(services, rates, month.Add(-1))

	resp := dashboardResponse{
		Month:              month.String(),
		TotalCents:         current.TotalCents,
		PreviousTotalCents: previous.TotalCents,
		DeltaCents:         current.TotalCents - previous.TotalCents,
		Projects:           make([]dashboardProject, 0, len(current.Projects)),
		MissingCurrencies:  emptyIfNil(current.MissingCurrencies),
	}
	// Variação percentual só faz sentido quando havia um valor no mês anterior.
	if previous.TotalCents > 0 {
		pct := float64(resp.DeltaCents) / float64(previous.TotalCents) * 100
		resp.DeltaPercent = &pct
	}
	for _, p := range current.Projects {
		share := 0.0
		if current.TotalCents > 0 {
			share = float64(p.TotalCents) / float64(current.TotalCents) * 100
		}
		resp.Projects = append(resp.Projects, dashboardProject{
			ProjectID:    p.ProjectID.String(),
			Name:         p.ProjectName,
			Color:        p.ProjectColor,
			TotalCents:   p.TotalCents,
			SharePercent: share,
			ServiceCount: len(p.Services),
			MissingRate:  p.MissingRate,
		})
	}
	writeJSON(w, http.StatusOK, resp)
}

type evolutionProject struct {
	ProjectID  string `json:"project_id"`
	Name       string `json:"name"`
	Color      string `json:"color"`
	TotalCents int64  `json:"total_cents"`
}

type evolutionPoint struct {
	Month      string             `json:"month"`
	TotalCents int64              `json:"total_cents"`
	Projects   []evolutionProject `json:"projects"`
}

func (s *Server) handleEvolution(w http.ResponseWriter, r *http.Request) {
	month, err := monthParam(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	count := evolutionMonths
	if raw := r.URL.Query().Get("months"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed < 1 || parsed > maxEvolutionMonths {
			writeError(w, http.StatusBadRequest, "número de meses inválido")
			return
		}
		count = parsed
	}

	services, rates, err := s.loadCostingInputs(r.Context(), currentUser(r).ID)
	if err != nil {
		writeServerError(w, "carregando evolução", err)
		return
	}

	months := costing.ComputeMonths(services, rates, costing.Range(month, count))
	points := make([]evolutionPoint, 0, len(months))
	for _, m := range months {
		point := evolutionPoint{
			Month:      m.Month.String(),
			TotalCents: m.TotalCents,
			Projects:   make([]evolutionProject, 0, len(m.Projects)),
		}
		for _, p := range m.Projects {
			point.Projects = append(point.Projects, evolutionProject{
				ProjectID:  p.ProjectID.String(),
				Name:       p.ProjectName,
				Color:      p.ProjectColor,
				TotalCents: p.TotalCents,
			})
		}
		points = append(points, point)
	}
	writeJSON(w, http.StatusOK, map[string]any{"months": points})
}

type summaryService struct {
	serviceResponse
	OriginalCents  int64    `json:"original_cents"`
	ConvertedCents int64    `json:"converted_cents"`
	Rate           *float64 `json:"rate"`
	MissingRate    bool     `json:"missing_rate"`
}

type categoryTotal struct {
	Category   string `json:"category"`
	TotalCents int64  `json:"total_cents"`
}

type projectSummaryResponse struct {
	Project           projectResponse  `json:"project"`
	Month             string           `json:"month"`
	TotalCents        int64            `json:"total_cents"`
	Services          []summaryService `json:"services"`
	Categories        []categoryTotal  `json:"categories"`
	Evolution         []evolutionPoint `json:"evolution"`
	MissingCurrencies []string         `json:"missing_currencies"`
}

func (s *Server) handleProjectSummary(w http.ResponseWriter, r *http.Request) {
	projectID, err := pathUUID(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "identificador de projeto inválido")
		return
	}
	month, err := monthParam(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	userID := currentUser(r).ID

	project, err := s.queries.GetProject(r.Context(), sqlc.GetProjectParams{ID: projectID, UserID: userID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "projeto não encontrado")
			return
		}
		writeServerError(w, "buscando projeto", err)
		return
	}

	rows, err := s.queries.ListServicesByProject(r.Context(), sqlc.ListServicesByProjectParams{
		UserID:    userID,
		ProjectID: projectID,
	})
	if err != nil {
		writeServerError(w, "listando serviços do projeto", err)
		return
	}
	rateRows, err := s.queries.ListExchangeRates(r.Context(), userID)
	if err != nil {
		writeServerError(w, "listando cotações", err)
		return
	}
	rates := costing.NewRateTable(toCostingRates(rateRows))

	services := make([]costing.Service, 0, len(rows))
	byID := make(map[string]sqlc.Service, len(rows))
	for _, row := range rows {
		byID[row.ID.String()] = row
		services = append(services, toCostingService(sqlc.ListServicesForUserRow{
			ID:           row.ID,
			ProjectID:    row.ProjectID,
			Name:         row.Name,
			Category:     row.Category,
			AmountCents:  row.AmountCents,
			Currency:     row.Currency,
			BillingCycle: row.BillingCycle,
			StartsOn:     row.StartsOn,
			EndsOn:       row.EndsOn,
			Notes:        row.Notes,
			ProjectName:  project.Name,
			ProjectColor: project.Color,
		}))
	}

	resp := projectSummaryResponse{
		Project:    toProjectResponse(project),
		Month:      month.String(),
		Services:   make([]summaryService, 0, len(rows)),
		Categories: make([]categoryTotal, 0),
		Evolution:  make([]evolutionPoint, 0, evolutionMonths),
	}

	current := costing.ComputeMonth(services, rates, month)
	categoryTotals := make(map[string]int64)
	var categoryOrder []string
	for _, p := range current.Projects {
		resp.TotalCents += p.TotalCents
		for _, sc := range p.Services {
			item := summaryService{
				serviceResponse: toServiceResponse(byID[sc.Service.ID.String()]),
				OriginalCents:   sc.OriginalCents,
				ConvertedCents:  sc.ConvertedCents,
				MissingRate:     sc.MissingRate,
			}
			if !sc.MissingRate {
				rate := float64(sc.RateE8) / rateScale
				item.Rate = &rate
				if _, seen := categoryTotals[sc.Service.Category]; !seen {
					categoryOrder = append(categoryOrder, sc.Service.Category)
				}
				categoryTotals[sc.Service.Category] += sc.ConvertedCents
			}
			resp.Services = append(resp.Services, item)
		}
	}
	resp.MissingCurrencies = emptyIfNil(current.MissingCurrencies)
	for _, category := range categoryOrder {
		resp.Categories = append(resp.Categories, categoryTotal{
			Category:   category,
			TotalCents: categoryTotals[category],
		})
	}
	// Categorias mais caras primeiro; empate resolvido pelo nome para estabilidade.
	sort.SliceStable(resp.Categories, func(i, j int) bool {
		if resp.Categories[i].TotalCents != resp.Categories[j].TotalCents {
			return resp.Categories[i].TotalCents > resp.Categories[j].TotalCents
		}
		return resp.Categories[i].Category < resp.Categories[j].Category
	})

	for _, m := range costing.ComputeMonths(services, rates, costing.Range(month, evolutionMonths)) {
		resp.Evolution = append(resp.Evolution, evolutionPoint{
			Month:      m.Month.String(),
			TotalCents: m.TotalCents,
			Projects:   []evolutionProject{},
		})
	}
	writeJSON(w, http.StatusOK, resp)
}

// emptyIfNil garante que a API devolva [] em vez de null para listas vazias,
// o que simplifica o consumo no frontend.
func emptyIfNil(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}
