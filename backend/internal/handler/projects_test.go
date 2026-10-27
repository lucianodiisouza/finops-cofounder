package handler

import (
	"net/http"
	"testing"
)

func TestProjectCRUD(t *testing.T) {
	c := newTestServer(t)
	c.login()

	var created projectResponse
	c.decode(http.MethodPost, "/api/projects",
		map[string]string{"name": "Loja Online", "description": "E-commerce", "color": "#2a78d6"},
		http.StatusCreated, &created)
	if created.Name != "Loja Online" || created.Color != "#2a78d6" || created.Archived {
		t.Fatalf("projeto criado = %+v", created)
	}

	var list []projectResponse
	c.decode(http.MethodGet, "/api/projects", nil, http.StatusOK, &list)
	if len(list) != 1 {
		t.Fatalf("len(projetos) = %d, quero 1", len(list))
	}

	var updated projectResponse
	c.decode(http.MethodPut, "/api/projects/"+created.ID,
		map[string]string{"name": "Loja Nova", "description": "Renomeada", "color": "#eb6834"},
		http.StatusOK, &updated)
	if updated.Name != "Loja Nova" || updated.Color != "#eb6834" {
		t.Errorf("projeto atualizado = %+v", updated)
	}

	var archived projectResponse
	c.decode(http.MethodPost, "/api/projects/"+created.ID+"/archive",
		map[string]bool{"archived": true}, http.StatusOK, &archived)
	if !archived.Archived {
		t.Error("o projeto deveria estar arquivado")
	}
	c.decode(http.MethodPost, "/api/projects/"+created.ID+"/archive",
		map[string]bool{"archived": false}, http.StatusOK, &archived)
	if archived.Archived {
		t.Error("o projeto deveria estar reativado")
	}

	if status, _ := c.do(http.MethodDelete, "/api/projects/"+created.ID, nil); status != http.StatusNoContent {
		t.Errorf("exclusão = %d, quero 204", status)
	}
	c.decode(http.MethodGet, "/api/projects", nil, http.StatusOK, &list)
	if len(list) != 0 {
		t.Errorf("len(projetos) após exclusão = %d, quero 0", len(list))
	}
}

func TestProjectValidation(t *testing.T) {
	c := newTestServer(t)
	c.login()

	tests := []struct {
		name string
		body map[string]string
	}{
		{"nome vazio", map[string]string{"name": "", "description": "", "color": "#2a78d6"}},
		{"nome só com espaços", map[string]string{"name": "   ", "description": "", "color": "#2a78d6"}},
		{"cor inválida", map[string]string{"name": "X", "description": "", "color": "azul"}},
		{"cor sem cerquilha", map[string]string{"name": "X", "description": "", "color": "2a78d6"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if status, _ := c.do(http.MethodPost, "/api/projects", tt.body); status != http.StatusBadRequest {
				t.Errorf("status = %d, quero 400", status)
			}
		})
	}
}

func TestProjectColorDefaultsWhenEmpty(t *testing.T) {
	c := newTestServer(t)
	c.login()

	var created projectResponse
	c.decode(http.MethodPost, "/api/projects",
		map[string]string{"name": "Sem cor", "description": "", "color": ""},
		http.StatusCreated, &created)
	if created.Color == "" {
		t.Error("a cor deveria receber um valor padrão")
	}
}

// TestProjectIsolationBetweenUsers garante que um usuário não alcança os projetos de outro.
func TestProjectIsolationBetweenUsers(t *testing.T) {
	owner := newTestServer(t)
	owner.login()
	projectID := owner.newProject("Projeto do dono")

	intruder := newTestServer(t)
	intruder.login()

	cases := []struct {
		name   string
		method string
		path   string
		body   any
		want   int
	}{
		{"resumo", http.MethodGet, "/api/projects/" + projectID + "/summary", nil, http.StatusNotFound},
		{"edição", http.MethodPut, "/api/projects/" + projectID,
			map[string]string{"name": "Invadido", "description": "", "color": "#2a78d6"}, http.StatusNotFound},
		{"arquivamento", http.MethodPost, "/api/projects/" + projectID + "/archive",
			map[string]bool{"archived": true}, http.StatusNotFound},
		{"exclusão", http.MethodDelete, "/api/projects/" + projectID, nil, http.StatusNotFound},
		{"criação de serviço", http.MethodPost, "/api/projects/" + projectID + "/services",
			map[string]any{
				"name": "Serviço intruso", "category": "servidor", "amount_cents": 100,
				"currency": "BRL", "billing_cycle": "monthly", "starts_on": "2026-10-01", "notes": "",
			}, http.StatusNotFound},
	}
	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			if status, _ := intruder.do(tt.method, tt.path, tt.body); status != tt.want {
				t.Errorf("status = %d, quero %d", status, tt.want)
			}
		})
	}

	// O projeto do dono segue intacto.
	var list []projectResponse
	owner.decode(http.MethodGet, "/api/projects", nil, http.StatusOK, &list)
	if len(list) != 1 || list[0].Name != "Projeto do dono" {
		t.Errorf("projetos do dono = %+v, quero o original intacto", list)
	}
}

func TestProjectNotFoundForUnknownID(t *testing.T) {
	c := newTestServer(t)
	c.login()

	const unknown = "11111111-1111-1111-1111-111111111111"
	if status, _ := c.do(http.MethodGet, "/api/projects/"+unknown+"/summary", nil); status != http.StatusNotFound {
		t.Errorf("status para id inexistente = %d, quero 404", status)
	}
	if status, _ := c.do(http.MethodGet, "/api/projects/nao-e-uuid/summary", nil); status != http.StatusBadRequest {
		t.Errorf("status para id inválido = %d, quero 400", status)
	}
}
