CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);

CREATE TABLE IF NOT EXISTS projects (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    color       TEXT NOT NULL DEFAULT '#3b82f6',
    archived_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS projects_user_id_idx ON projects(user_id);

-- amount_cents: valor em centavos da moeda informada (ver ADR 001)
-- billing_cycle: 'monthly' | 'yearly' (anual é rateado por 12 no cálculo)
CREATE TABLE IF NOT EXISTS services (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    category      TEXT NOT NULL,
    amount_cents  BIGINT NOT NULL CHECK (amount_cents >= 0),
    currency      TEXT NOT NULL CHECK (currency IN ('BRL', 'USD', 'EUR')),
    billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
    starts_on     DATE NOT NULL,
    ends_on       DATE,
    notes         TEXT NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (ends_on IS NULL OR ends_on >= starts_on)
);

CREATE INDEX IF NOT EXISTS services_project_id_idx ON services(project_id);

-- rate_e8: cotação multiplicada por 10^8 (5,40 BRL/USD => 540000000). Ver ADR 001 e 002.
-- month: sempre o primeiro dia do mês de competência.
CREATE TABLE IF NOT EXISTS exchange_rates (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    currency   TEXT NOT NULL CHECK (currency IN ('USD', 'EUR')),
    month      DATE NOT NULL,
    rate_e8    BIGINT NOT NULL CHECK (rate_e8 > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, currency, month)
);

CREATE INDEX IF NOT EXISTS exchange_rates_lookup_idx ON exchange_rates(user_id, currency, month DESC);
