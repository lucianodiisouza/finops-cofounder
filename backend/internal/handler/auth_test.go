package handler

import (
	"net/http"
	"testing"
)

func TestHealthEndpoint(t *testing.T) {
	c := newTestServer(t)
	if status, body := c.do(http.MethodGet, "/up", nil); status != http.StatusOK || string(body) != "ok" {
		t.Errorf("GET /up = (%d, %q), quero (200, \"ok\")", status, body)
	}
}

func TestRegisterAndLogin(t *testing.T) {
	c := newTestServer(t)
	const email = "cadastro@finops.test"
	const password = "senha-muito-boa"

	var created userResponse
	c.decode(http.MethodPost, "/api/auth/register",
		map[string]string{"email": email, "password": password},
		http.StatusCreated, &created)
	if created.Email != email {
		t.Errorf("e-mail cadastrado = %q, quero %q", created.Email, email)
	}
	t.Cleanup(func() {
		_, _ = testPool.Exec(t.Context(), `DELETE FROM users WHERE email = $1`, email)
	})

	// O cadastro já autentica: /api/me deve responder.
	var me userResponse
	c.decode(http.MethodGet, "/api/me", nil, http.StatusOK, &me)
	if me.ID != created.ID {
		t.Errorf("usuário da sessão = %q, quero %q", me.ID, created.ID)
	}

	// O mesmo e-mail não pode ser cadastrado duas vezes.
	if status, _ := c.do(http.MethodPost, "/api/auth/register",
		map[string]string{"email": email, "password": password}); status != http.StatusConflict {
		t.Errorf("cadastro duplicado = %d, quero 409", status)
	}

	// Logout encerra a sessão.
	if status, _ := c.do(http.MethodPost, "/api/auth/logout", nil); status != http.StatusNoContent {
		t.Errorf("logout = %d, quero 204", status)
	}
	if status, _ := c.do(http.MethodGet, "/api/me", nil); status != http.StatusUnauthorized {
		t.Errorf("/api/me após logout = %d, quero 401", status)
	}

	// Login com a senha certa funciona; com a errada, não.
	c.decode(http.MethodPost, "/api/auth/login",
		map[string]string{"email": email, "password": password}, http.StatusOK, nil)
	if status, _ := c.do(http.MethodPost, "/api/auth/login",
		map[string]string{"email": email, "password": "senha-errada"}); status != http.StatusUnauthorized {
		t.Errorf("login com senha errada = %d, quero 401", status)
	}
}

func TestRegisterValidation(t *testing.T) {
	c := newTestServer(t)
	tests := []struct {
		name     string
		email    string
		password string
	}{
		{"e-mail vazio", "", "senha-muito-boa"},
		{"e-mail sem arroba", "nao-e-email", "senha-muito-boa"},
		{"senha curta", "curta@finops.test", "1234567"},
		{"senha vazia", "vazia@finops.test", ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			status, _ := c.do(http.MethodPost, "/api/auth/register",
				map[string]string{"email": tt.email, "password": tt.password})
			if status != http.StatusBadRequest {
				t.Errorf("status = %d, quero 400", status)
			}
		})
	}
}

func TestLoginWithUnknownEmail(t *testing.T) {
	c := newTestServer(t)
	status, _ := c.do(http.MethodPost, "/api/auth/login",
		map[string]string{"email": "ninguem@finops.test", "password": "senha-muito-boa"})
	if status != http.StatusUnauthorized {
		t.Errorf("status = %d, quero 401", status)
	}
}

func TestProtectedRoutesRequireSession(t *testing.T) {
	c := newTestServer(t)
	routes := []struct{ method, path string }{
		{http.MethodGet, "/api/me"},
		{http.MethodGet, "/api/projects"},
		{http.MethodPost, "/api/projects"},
		{http.MethodGet, "/api/rates"},
		{http.MethodGet, "/api/dashboard"},
		{http.MethodGet, "/api/evolution"},
	}
	for _, route := range routes {
		t.Run(route.method+" "+route.path, func(t *testing.T) {
			var body any
			if route.method == http.MethodPost {
				body = map[string]string{"name": "x"}
			}
			if status, _ := c.do(route.method, route.path, body); status != http.StatusUnauthorized {
				t.Errorf("status = %d, quero 401", status)
			}
		})
	}
}
