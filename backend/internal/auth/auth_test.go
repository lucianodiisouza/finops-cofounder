package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHashAndCheckPassword(t *testing.T) {
	hash, err := HashPassword("senha-muito-boa")
	if err != nil {
		t.Fatalf("HashPassword devolveu erro: %v", err)
	}
	if hash == "senha-muito-boa" {
		t.Fatal("a senha não foi transformada em hash")
	}
	if !CheckPassword(hash, "senha-muito-boa") {
		t.Error("a senha correta deveria ser aceita")
	}
	if CheckPassword(hash, "senha-errada") {
		t.Error("a senha errada deveria ser rejeitada")
	}
	// Hash vazio é o caso do usuário criado pelo login de desenvolvimento:
	// nenhuma senha pode autenticá-lo.
	if CheckPassword("", "qualquer-coisa") {
		t.Error("hash vazio não deveria aceitar nenhuma senha")
	}
}

func TestNewTokenIsRandom(t *testing.T) {
	seen := make(map[string]bool)
	for range 20 {
		token, err := NewToken()
		if err != nil {
			t.Fatalf("NewToken devolveu erro: %v", err)
		}
		if len(token) < 32 {
			t.Errorf("token muito curto: %q", token)
		}
		if seen[token] {
			t.Fatalf("token repetido: %q", token)
		}
		seen[token] = true
	}
}

func TestCookieLifecycle(t *testing.T) {
	// Fora do modo de desenvolvimento o cookie precisa ser Secure.
	recorder := httptest.NewRecorder()
	SetCookie(recorder, "abc123", false)
	cookie := recorder.Result().Cookies()[0]
	if cookie.Name != CookieName || cookie.Value != "abc123" {
		t.Errorf("cookie = %+v", cookie)
	}
	if !cookie.HttpOnly || !cookie.Secure || cookie.SameSite != http.SameSiteLaxMode {
		t.Errorf("atributos de segurança do cookie = %+v", cookie)
	}

	// Em desenvolvimento o acesso é por http://localhost, então Secure fica desligado.
	recorder = httptest.NewRecorder()
	SetCookie(recorder, "abc123", true)
	if recorder.Result().Cookies()[0].Secure {
		t.Error("em modo de desenvolvimento o cookie não deveria ser Secure")
	}

	recorder = httptest.NewRecorder()
	ClearCookie(recorder, true)
	cleared := recorder.Result().Cookies()[0]
	if cleared.Value != "" || cleared.MaxAge >= 0 {
		t.Errorf("cookie limpo = %+v, quero valor vazio e MaxAge negativo", cleared)
	}
}
