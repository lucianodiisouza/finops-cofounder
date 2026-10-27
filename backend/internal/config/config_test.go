package config

import "testing"

func TestLoadRequiresDatabaseURL(t *testing.T) {
	t.Setenv("DATABASE_URL", "")
	if _, err := Load(); err == nil {
		t.Error("Load deveria falhar sem DATABASE_URL")
	}
}

func TestLoadAppliesDefaults(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/db")
	t.Setenv("PORT", "")
	t.Setenv("BASE_URL", "")
	t.Setenv("DEV_MODE", "")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load devolveu erro: %v", err)
	}
	if cfg.Port != "8080" {
		t.Errorf("Port = %q, quero \"8080\"", cfg.Port)
	}
	if cfg.BaseURL != "http://localhost:8080" {
		t.Errorf("BaseURL = %q, quero derivada da porta", cfg.BaseURL)
	}
	if cfg.DevMode {
		t.Error("DevMode deveria ser falso sem a variável definida")
	}
}

func TestLoadReadsEnvironment(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/db")
	t.Setenv("PORT", "80")
	t.Setenv("BASE_URL", "https://finops.example.com")
	t.Setenv("DEV_MODE", "1")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load devolveu erro: %v", err)
	}
	if cfg.Port != "80" || cfg.BaseURL != "https://finops.example.com" || !cfg.DevMode {
		t.Errorf("cfg = %+v", cfg)
	}
}
