// Package auth concentra hash de senha, geração de token de sessão e o cookie.
package auth

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"net/http"
	"time"

	"golang.org/x/crypto/bcrypt"
)

// CookieName é o nome do cookie de sessão.
const CookieName = "finops_session"

// SessionTTL é a validade de uma sessão.
const SessionTTL = 30 * 24 * time.Hour

// HashPassword gera o hash bcrypt de uma senha.
func HashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", fmt.Errorf("gerando hash da senha: %w", err)
	}
	return string(hash), nil
}

// CheckPassword compara uma senha com o hash armazenado.
func CheckPassword(hash, password string) bool {
	if hash == "" {
		return false
	}
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

// NewToken gera um token de sessão aleatório.
func NewToken() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("gerando token de sessão: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

// SetCookie grava o cookie de sessão na resposta.
// Secure só é ativado fora do modo de desenvolvimento, onde o acesso é por http://localhost.
func SetCookie(w http.ResponseWriter, token string, devMode bool) {
	http.SetCookie(w, &http.Cookie{
		Name:     CookieName,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		Secure:   !devMode,
		SameSite: http.SameSiteLaxMode,
		Expires:  time.Now().Add(SessionTTL),
	})
}

// ClearCookie apaga o cookie de sessão.
func ClearCookie(w http.ResponseWriter, devMode bool) {
	http.SetCookie(w, &http.Cookie{
		Name:     CookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   !devMode,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
	})
}
