CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_members (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    registration TEXT NOT NULL UNIQUE,
    email TEXT,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    allowed_base_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    rating NUMERIC(3,2) NOT NULL DEFAULT 5.0,
    services_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'offline',
    avatar TEXT NOT NULL,
    efficiency TEXT NOT NULL DEFAULT '100%',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE team_members
    ADD COLUMN IF NOT EXISTS allowed_base_ids JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE team_members
    ADD COLUMN IF NOT EXISTS email TEXT;

UPDATE team_members
SET email = NULL
WHERE email IS NOT NULL
  AND BTRIM(email) = '';

UPDATE team_members
SET
    allowed_base_ids = '["flores","sao-jose","cidade-nova","ponta-negra","taruma"]'::jsonb,
    updated_at = NOW()
WHERE role = 'Clientes'
  AND COALESCE(jsonb_array_length(allowed_base_ids), 0) = 0;

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
    washing_zone_id TEXT,
    washing_zone_name TEXT,
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
    ADD COLUMN IF NOT EXISTS washing_zone_id TEXT;

ALTER TABLE services
    ADD COLUMN IF NOT EXISTS washing_zone_name TEXT;

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
    washing_zone_id TEXT,
    washing_zone_name TEXT,
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

ALTER TABLE appointments
    ADD COLUMN IF NOT EXISTS washing_zone_id TEXT;

ALTER TABLE appointments
    ADD COLUMN IF NOT EXISTS washing_zone_name TEXT;

UPDATE appointments
SET
    washing_zone_id = CASE
        WHEN COALESCE(vehicle_type, '') = 'truck' THEN 'dique_pesada'
        ELSE 'dique_leve'
    END,
    washing_zone_name = CASE
        WHEN COALESCE(vehicle_type, '') = 'truck' THEN 'Dique Pesada'
        ELSE 'Dique Leve'
    END,
    updated_at = NOW()
WHERE base_id = 'taruma'
  AND (washing_zone_id IS NULL OR BTRIM(washing_zone_id) = '');

UPDATE services
SET
    washing_zone_id = CASE
        WHEN appointments.washing_zone_id IS NOT NULL AND BTRIM(appointments.washing_zone_id) <> '' THEN appointments.washing_zone_id
        WHEN COALESCE(services.type, '') = 'truck' THEN 'dique_pesada'
        ELSE 'dique_leve'
    END,
    washing_zone_name = CASE
        WHEN appointments.washing_zone_name IS NOT NULL AND BTRIM(appointments.washing_zone_name) <> '' THEN appointments.washing_zone_name
        WHEN COALESCE(services.type, '') = 'truck' THEN 'Dique Pesada'
        ELSE 'Dique Leve'
    END,
    updated_at = NOW()
FROM appointments
WHERE services.id = appointments.id
  AND services.base_id = 'taruma'
  AND (services.washing_zone_id IS NULL OR BTRIM(services.washing_zone_id) = '');

UPDATE services
SET
    washing_zone_id = CASE
        WHEN COALESCE(type, '') = 'truck' THEN 'dique_pesada'
        ELSE 'dique_leve'
    END,
    washing_zone_name = CASE
        WHEN COALESCE(type, '') = 'truck' THEN 'Dique Pesada'
        ELSE 'Dique Leve'
    END,
    updated_at = NOW()
WHERE base_id = 'taruma'
  AND (washing_zone_id IS NULL OR BTRIM(washing_zone_id) = '');

CREATE TABLE IF NOT EXISTS auth_sessions (
    token TEXT PRIMARY KEY,
    member_id TEXT NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_member_id ON auth_sessions (member_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions (expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_members_email_unique
    ON team_members (LOWER(email))
    WHERE email IS NOT NULL AND BTRIM(email) <> '';

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
CREATE INDEX IF NOT EXISTS idx_services_base_status_date ON services (base_id, status, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_appointments_date_status ON appointments (date, status);
CREATE INDEX IF NOT EXISTS idx_appointments_base_date_status ON appointments (base_id, date, status);
DROP INDEX IF EXISTS idx_appointments_unique_plate_slot_active;

CREATE UNIQUE INDEX idx_appointments_unique_plate_slot_active
    ON appointments ((UPPER(plate)), date, time)
    WHERE status IN ('confirmed', 'pending');
