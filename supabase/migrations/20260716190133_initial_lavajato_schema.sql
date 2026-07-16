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

CREATE TABLE IF NOT EXISTS vehicles (
    plate TEXT PRIMARY KEY,
    customer TEXT NOT NULL,
    model TEXT NOT NULL,
    type TEXT NOT NULL,
    source_vehicle_type TEXT,
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
    created_by_id TEXT,
    created_by_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_sessions (
    token TEXT PRIMARY KEY,
    member_id TEXT NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

CREATE INDEX IF NOT EXISTS idx_auth_sessions_member_id ON auth_sessions (member_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions (expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_members_email_unique
    ON team_members (LOWER(email))
    WHERE email IS NOT NULL AND BTRIM(email) <> '';
CREATE INDEX IF NOT EXISTS idx_services_status_date ON services (status, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_services_base_status_date ON services (base_id, status, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_appointments_date_status ON appointments (date, status);
CREATE INDEX IF NOT EXISTS idx_appointments_base_date_status ON appointments (base_id, date, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_unique_plate_slot_active
    ON appointments ((UPPER(plate)), date, time)
    WHERE status IN ('confirmed', 'pending');

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE app_settings FROM anon, authenticated;
REVOKE ALL ON TABLE team_members FROM anon, authenticated;
REVOKE ALL ON TABLE vehicles FROM anon, authenticated;
REVOKE ALL ON TABLE services FROM anon, authenticated;
REVOKE ALL ON TABLE appointments FROM anon, authenticated;
REVOKE ALL ON TABLE auth_sessions FROM anon, authenticated;
REVOKE ALL ON TABLE products FROM anon, authenticated;
