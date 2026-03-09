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
    sort_order INTEGER NOT NULL DEFAULT 0,
    plate TEXT NOT NULL,
    model TEXT NOT NULL,
    type TEXT NOT NULL,
    base_id TEXT,
    base_name TEXT,
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
    timeline JSONB NOT NULL DEFAULT '{}'::jsonb,
    pre_inspection_photos JSONB NOT NULL DEFAULT '{}'::jsonb,
    post_inspection_photos JSONB NOT NULL DEFAULT '{}'::jsonb,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    image TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE services
    ADD COLUMN IF NOT EXISTS base_id TEXT;

ALTER TABLE services
    ADD COLUMN IF NOT EXISTS base_name TEXT;

ALTER TABLE services
    ADD COLUMN IF NOT EXISTS timeline JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE services
    ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

ALTER TABLE services
    ADD COLUMN IF NOT EXISTS pre_inspection_photos JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE services
    ADD COLUMN IF NOT EXISTS post_inspection_photos JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY,
    customer TEXT NOT NULL,
    vehicle TEXT NOT NULL,
    plate TEXT NOT NULL,
    base_id TEXT,
    base_name TEXT,
    vehicle_type TEXT,
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

ALTER TABLE appointments
    ADD COLUMN IF NOT EXISTS vehicle_type TEXT;

ALTER TABLE appointments
    ADD COLUMN IF NOT EXISTS base_id TEXT;

ALTER TABLE appointments
    ADD COLUMN IF NOT EXISTS base_name TEXT;

CREATE TABLE IF NOT EXISTS auth_sessions (
    token TEXT PRIMARY KEY,
    member_id TEXT NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_member_id ON auth_sessions (member_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions (expires_at);

WITH ranked_active_appointments AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY UPPER(plate), date, time
            ORDER BY updated_at DESC, created_at DESC, id DESC
        ) AS duplicate_rank
    FROM appointments
    WHERE status IN ('confirmed', 'pending')
)
DELETE FROM appointments
WHERE id IN (
    SELECT id
    FROM ranked_active_appointments
    WHERE duplicate_rank > 1
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
    manual_entries JSONB NOT NULL DEFAULT '[]'::jsonb,
    manual_outputs JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS manual_entries JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS manual_outputs JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_services_status_date ON services (status, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_appointments_date_status ON appointments (date, status);
DROP INDEX IF EXISTS idx_appointments_unique_plate_slot_active;

CREATE UNIQUE INDEX idx_appointments_unique_plate_slot_active
    ON appointments ((UPPER(plate)), date, time)
    WHERE status IN ('confirmed', 'pending');
