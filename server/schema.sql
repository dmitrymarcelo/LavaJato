CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_members (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    registration TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    rating NUMERIC(3,2) NOT NULL DEFAULT 5.0,
    services_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'offline',
    avatar TEXT NOT NULL,
    efficiency TEXT NOT NULL DEFAULT '100%',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vehicles (
    plate TEXT PRIMARY KEY,
    customer TEXT NOT NULL,
    model TEXT NOT NULL,
    type TEXT NOT NULL,
    city TEXT,
    state TEXT,
    last_service TEXT,
    third_party_name TEXT,
    third_party_cpf TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY,
    plate TEXT NOT NULL,
    model TEXT NOT NULL,
    type TEXT NOT NULL,
    scheduled_date DATE,
    scheduled_time TIME,
    status TEXT NOT NULL,
    price NUMERIC(10,2) NOT NULL DEFAULT 0,
    priority BOOLEAN NOT NULL DEFAULT FALSE,
    customer TEXT NOT NULL,
    third_party_name TEXT,
    third_party_cpf TEXT,
    observations TEXT,
    washer TEXT,
    washers JSONB NOT NULL DEFAULT '[]'::jsonb,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    image TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY,
    customer TEXT NOT NULL,
    vehicle TEXT NOT NULL,
    plate TEXT NOT NULL,
    service TEXT NOT NULL,
    date DATE NOT NULL,
    time TIME NOT NULL,
    status TEXT NOT NULL,
    photo TEXT,
    third_party_name TEXT,
    third_party_cpf TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    min_quantity INTEGER NOT NULL DEFAULT 0,
    unit TEXT NOT NULL,
    price NUMERIC(10,2) NOT NULL DEFAULT 0,
    last_restock DATE,
    status TEXT NOT NULL,
    image TEXT,
    manual_outputs JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS manual_outputs JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_services_status_date ON services (status, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_appointments_date_status ON appointments (date, status);
