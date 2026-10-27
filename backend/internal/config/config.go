// Package config carrega a configuração da aplicação a partir de variáveis de ambiente.
package config

import (
	"fmt"
	"os"
)

// Config reúne tudo que o servidor precisa para subir.
type Config struct {
	DatabaseURL string
	Port        string
	BaseURL     string
	DevMode     bool
}

// Load lê as variáveis de ambiente e falha quando algo obrigatório está ausente.
func Load() (Config, error) {
	cfg := Config{
		DatabaseURL: os.Getenv("DATABASE_URL"),
		Port:        os.Getenv("PORT"),
		BaseURL:     os.Getenv("BASE_URL"),
		DevMode:     os.Getenv("DEV_MODE") != "",
	}
	if cfg.DatabaseURL == "" {
		return Config{}, fmt.Errorf("DATABASE_URL é obrigatória")
	}
	if cfg.Port == "" {
		cfg.Port = "8080"
	}
	if cfg.BaseURL == "" {
		cfg.BaseURL = "http://localhost:" + cfg.Port
	}
	return cfg, nil
}
