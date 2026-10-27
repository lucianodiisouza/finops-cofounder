package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/lucianodiisouza/finops-cofounder/backend/internal/config"
	"github.com/lucianodiisouza/finops-cofounder/backend/internal/database"
)

// O pool é compartilhado entre os testes: migrations rodam uma única vez.
var (
	testPool *pgxpool.Pool
	poolOnce sync.Once
	poolErr  error
)

func pool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL não definida — rode os testes com `set -a && . .env && set +a`")
	}
	poolOnce.Do(func() {
		ctx := context.Background()
		testPool, poolErr = pgxpool.New(ctx, url)
		if poolErr != nil {
			return
		}
		if poolErr = testPool.Ping(ctx); poolErr != nil {
			return
		}
		poolErr = database.Migrate(ctx, testPool)
	})
	if poolErr != nil {
		t.Fatalf("preparando o banco de testes: %v", poolErr)
	}
	return testPool
}

// client é um cliente HTTP com cookie jar, para carregar a sessão entre chamadas.
type client struct {
	t       *testing.T
	baseURL string
	http    *http.Client
}

// newTestServer sobe a API contra o banco local. O usuário criado em `login`
// é removido no fim do teste, levando projetos e serviços por cascade.
func newTestServer(t *testing.T) *client {
	t.Helper()
	p := pool(t)
	mux := http.NewServeMux()
	New(config.Config{DevMode: true, Port: "0", BaseURL: "http://localhost"}, p).Routes(mux)
	server := httptest.NewServer(mux)
	t.Cleanup(server.Close)

	jar, err := cookiejar.New(nil)
	if err != nil {
		t.Fatalf("criando cookie jar: %v", err)
	}
	return &client{t: t, baseURL: server.URL, http: &http.Client{Jar: jar}}
}

// do envia uma requisição JSON e devolve status e corpo bruto.
func (c *client) do(method, path string, body any) (int, []byte) {
	c.t.Helper()
	var reader *strings.Reader
	if body != nil {
		encoded, err := json.Marshal(body)
		if err != nil {
			c.t.Fatalf("serializando corpo: %v", err)
		}
		reader = strings.NewReader(string(encoded))
	} else {
		reader = strings.NewReader("")
	}
	req, err := http.NewRequest(method, c.baseURL+path, reader)
	if err != nil {
		c.t.Fatalf("montando requisição: %v", err)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := c.http.Do(req)
	if err != nil {
		c.t.Fatalf("executando requisição: %v", err)
	}
	defer resp.Body.Close()
	raw := make([]byte, 0, 1024)
	buf := make([]byte, 1024)
	for {
		n, err := resp.Body.Read(buf)
		raw = append(raw, buf[:n]...)
		if err != nil {
			break
		}
	}
	return resp.StatusCode, raw
}

// decode exige um status específico e desserializa o corpo.
func (c *client) decode(method, path string, body any, wantStatus int, dst any) {
	c.t.Helper()
	status, raw := c.do(method, path, body)
	if status != wantStatus {
		c.t.Fatalf("%s %s = status %d (quero %d): %s", method, path, status, wantStatus, raw)
	}
	if dst != nil {
		if err := json.Unmarshal(raw, dst); err != nil {
			c.t.Fatalf("desserializando resposta de %s %s: %v (%s)", method, path, err, raw)
		}
	}
}

var emailCounter int

// login cria um usuário novo pelo endpoint de desenvolvimento e autentica o cliente.
func (c *client) login() string {
	c.t.Helper()
	emailCounter++
	email := fmt.Sprintf("teste-%d-%s@finops.test", emailCounter, strings.ToLower(c.t.Name()))
	email = strings.ReplaceAll(email, "/", "-")

	var user userResponse
	c.decode(http.MethodPost, "/api/dev/login", map[string]string{"email": email}, http.StatusOK, &user)

	c.t.Cleanup(func() {
		if _, err := testPool.Exec(context.Background(), `DELETE FROM users WHERE id = $1`, user.ID); err != nil {
			c.t.Logf("não foi possível limpar o usuário de teste: %v", err)
		}
	})
	return user.ID
}

// newProject cria um projeto e devolve o id.
func (c *client) newProject(name string) string {
	c.t.Helper()
	var project projectResponse
	c.decode(http.MethodPost, "/api/projects",
		map[string]string{"name": name, "description": "", "color": "#2a78d6"},
		http.StatusCreated, &project)
	return project.ID
}
