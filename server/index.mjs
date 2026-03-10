import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import { pool, query, withTransaction } from './db.mjs';
import { seedDatabase } from './seed.mjs';
import { getAssistantTips, getAssistantWeather } from './assistant.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.API_PORT || 4000);
const authSessionDays = Number(process.env.AUTH_SESSION_DAYS || 7);
const ALL_BASE_IDS = ['flores', 'sao-jose', 'cidade-nova', 'ponta-negra', 'taruma'];

app.use(cors());
app.use(express.json({ limit: '80mb' }));

function normalizeAllowedBaseIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) => String(item || '').trim())
        .filter((item) => ALL_BASE_IDS.includes(item))
    )
  );
}

function getAllowedBaseIdsForMember(member) {
  if (!member) {
    return [];
  }

  const rawIds = Array.isArray(member.allowed_base_ids)
    ? member.allowed_base_ids
    : Array.isArray(member.allowedBaseIds)
      ? member.allowedBaseIds
      : [];
  const normalized = normalizeAllowedBaseIds(rawIds);

  if (String(member.role || '').trim() === 'Clientes') {
    return normalized.length ? normalized : ALL_BASE_IDS;
  }

  return normalized;
}

function getBaseFilterForUser(user) {
  if (!user || user.role !== 'Clientes') {
    return null;
  }

  return getAllowedBaseIdsForMember(user);
}

function assertUserCanAccessBase(user, baseId) {
  if (!user || user.role !== 'Clientes') {
    return;
  }

  const allowedBaseIds = getAllowedBaseIdsForMember(user);
  if (!baseId || !allowedBaseIds.includes(baseId)) {
    const error = new Error('Voce nao tem acesso a esta base.');
    error.statusCode = 403;
    throw error;
  }
}

function toCamelProduct(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    quantity: row.quantity,
    minQuantity: row.min_quantity,
    unit: row.unit,
    price: Number(row.price),
    lastRestock: row.last_restock,
    status: row.status,
    image: row.image,
    manualEntries: Array.isArray(row.manual_entries) ? row.manual_entries : [],
    manualOutputs: Array.isArray(row.manual_outputs) ? row.manual_outputs : [],
  };
}

function toDateKey(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  const normalized = String(value).trim();
  if (!normalized) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return normalized.slice(0, 10);
  }

  return parsed.toISOString().slice(0, 10);
}

function toCamelService(row, options = {}) {
  const includePhotos = options.includePhotos !== false;
  return {
    id: row.id,
    sortOrder: row.sort_order,
    plate: row.plate,
    model: row.model,
    type: row.type,
    baseId: row.base_id,
    baseName: row.base_name,
    scheduledDate: toDateKey(row.scheduled_date),
    scheduledTime: row.scheduled_time?.slice?.(0, 5) || row.scheduled_time,
    status: row.status,
    price: Number(row.price),
    priority: row.priority,
    customer: row.customer,
    thirdPartyName: row.third_party_name,
    thirdPartyCpf: row.third_party_cpf,
    observations: row.observations,
    washer: row.washer,
    washers: row.washers || [],
    timeline: row.timeline || {},
    preInspectionPhotos: includePhotos ? (row.pre_inspection_photos || {}) : {},
    postInspectionPhotos: includePhotos ? (row.post_inspection_photos || {}) : {},
    startTime: row.start_time,
    endTime: row.end_time,
    image: row.image,
  };
}

function toCamelVehicle(row) {
  return {
    plate: row.plate,
    customer: row.customer,
    model: row.model,
    type: row.type,
    city: row.city,
    state: row.state,
    lastService: row.last_service,
    thirdPartyName: row.third_party_name,
    thirdPartyCpf: row.third_party_cpf,
  };
}

function toCamelTeam(row) {
  return {
    id: row.id,
    name: row.name,
    registration: row.registration,
    role: row.role,
    allowedBaseIds: getAllowedBaseIdsForMember(row),
    rating: Number(row.rating),
    servicesCount: row.services_count,
    status: row.status,
    avatar: row.avatar,
    efficiency: row.efficiency,
  };
}

function toCamelAppointment(row) {
  return {
    id: row.id,
    customer: row.customer,
    vehicle: row.vehicle,
    plate: row.plate,
    baseId: row.base_id,
    baseName: row.base_name,
    vehicleType: row.vehicle_type,
    service: row.service,
    date: toDateKey(row.date),
    time: row.time?.slice?.(0, 5) || row.time,
    status: row.status,
    photo: row.photo,
    thirdPartyName: row.third_party_name,
    thirdPartyCpf: row.third_party_cpf,
  };
}

async function runSchema() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
  await seedDatabase();
}

const servicesOrderSql = `
  CASE status
    WHEN 'pending' THEN 1
    WHEN 'in_progress' THEN 2
    WHEN 'waiting_payment' THEN 3
    WHEN 'completed' THEN 4
    WHEN 'no_show' THEN 5
    ELSE 6
  END,
  sort_order ASC,
  scheduled_date DESC NULLS LAST,
  scheduled_time DESC NULLS LAST,
  created_at DESC
`;

async function upsertServiceRow(service, executor = query) {
  await executor(
    `
    INSERT INTO services (
      id, sort_order, plate, model, type, base_id, base_name, scheduled_date, scheduled_time, status, price, priority, customer,
      third_party_name, third_party_cpf, observations, washer, washers, timeline, pre_inspection_photos, post_inspection_photos, start_time, end_time, image, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,$19::jsonb,$20::jsonb,$21::jsonb,$22,$23,$24,NOW())
    ON CONFLICT (id) DO UPDATE SET
      sort_order = EXCLUDED.sort_order,
      plate = EXCLUDED.plate,
      model = EXCLUDED.model,
      type = EXCLUDED.type,
      base_id = EXCLUDED.base_id,
      base_name = EXCLUDED.base_name,
      scheduled_date = EXCLUDED.scheduled_date,
      scheduled_time = EXCLUDED.scheduled_time,
      status = EXCLUDED.status,
      price = EXCLUDED.price,
      priority = EXCLUDED.priority,
      customer = EXCLUDED.customer,
      third_party_name = EXCLUDED.third_party_name,
      third_party_cpf = EXCLUDED.third_party_cpf,
      observations = EXCLUDED.observations,
      washer = EXCLUDED.washer,
      washers = EXCLUDED.washers,
      timeline = EXCLUDED.timeline,
      pre_inspection_photos = EXCLUDED.pre_inspection_photos,
      post_inspection_photos = EXCLUDED.post_inspection_photos,
      start_time = EXCLUDED.start_time,
      end_time = EXCLUDED.end_time,
      image = EXCLUDED.image,
      updated_at = NOW()
    `,
    [
      service.id,
      service.sortOrder || 0,
      service.plate,
      service.model,
      service.type,
      service.baseId || null,
      service.baseName || null,
      service.scheduledDate || null,
      service.scheduledTime || null,
      service.status,
      service.price || 0,
      Boolean(service.priority),
      service.customer,
      service.thirdPartyName || null,
      service.thirdPartyCpf || null,
      service.observations || null,
      service.washer || null,
      JSON.stringify(service.washers || []),
      JSON.stringify(service.timeline || {}),
      JSON.stringify(service.preInspectionPhotos || {}),
      JSON.stringify(service.postInspectionPhotos || {}),
      service.startTime || null,
      service.endTime || null,
      service.image || null,
    ]
  );
}

async function upsertVehicleRow(vehicle, executor = query) {
  const plate = String(vehicle.plate || '').toUpperCase().trim();
  if (!plate) {
    const error = new Error('Placa do veiculo e obrigatoria.');
    error.statusCode = 400;
    throw error;
  }

  await executor(
    `
    INSERT INTO vehicles (
      plate, customer, model, type, city, state, last_service, third_party_name, third_party_cpf, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
    ON CONFLICT (plate) DO UPDATE SET
      customer = EXCLUDED.customer,
      model = EXCLUDED.model,
      type = EXCLUDED.type,
      city = EXCLUDED.city,
      state = EXCLUDED.state,
      last_service = EXCLUDED.last_service,
      third_party_name = EXCLUDED.third_party_name,
      third_party_cpf = EXCLUDED.third_party_cpf,
      updated_at = NOW()
    `,
    [
      plate,
      vehicle.customer,
      vehicle.model,
      vehicle.type,
      vehicle.city || null,
      vehicle.state || null,
      vehicle.lastService || null,
      vehicle.thirdPartyName || null,
      vehicle.thirdPartyCpf || null,
    ]
  );
}

async function upsertProductRow(product, executor = query) {
  await executor(
    `
    INSERT INTO products (
      id, name, category, quantity, min_quantity, unit, price, last_restock, status, image, manual_entries, manual_outputs, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,NOW())
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      category = EXCLUDED.category,
      quantity = EXCLUDED.quantity,
      min_quantity = EXCLUDED.min_quantity,
      unit = EXCLUDED.unit,
      price = EXCLUDED.price,
      last_restock = EXCLUDED.last_restock,
      status = EXCLUDED.status,
      image = EXCLUDED.image,
      manual_entries = EXCLUDED.manual_entries,
      manual_outputs = EXCLUDED.manual_outputs,
      updated_at = NOW()
    `,
    [
      product.id,
      product.name,
      product.category,
      product.quantity,
      product.minQuantity,
      product.unit,
      product.price || 0,
      product.lastRestock || null,
      product.status,
      product.image || null,
      JSON.stringify(Array.isArray(product.manualEntries) ? product.manualEntries : []),
      JSON.stringify(Array.isArray(product.manualOutputs) ? product.manualOutputs : []),
    ]
  );
}

async function upsertTeamMemberRow(member, executor = query) {
  const registration = String(member.registration || '').trim();
  if (!registration) {
    const error = new Error('Matricula do colaborador e obrigatoria.');
    error.statusCode = 400;
    throw error;
  }

  const duplicate = await executor(
    `
    SELECT id
    FROM team_members
    WHERE registration = $1
      AND id <> $2
    LIMIT 1
    `,
    [registration, member.id]
  );

  if (duplicate.rows[0]) {
    const error = new Error('Ja existe um colaborador com esta matricula.');
    error.statusCode = 409;
    throw error;
  }

  const currentMember = await executor('SELECT password_hash, avatar FROM team_members WHERE id = $1', [member.id]);
  const passwordHash = member.passwordHash
    || (member.password ? await bcrypt.hash(member.password, 10) : currentMember.rows[0]?.password_hash)
    || await bcrypt.hash('Admin@123456!', 10);
  const allowedBaseIds = member.role === 'Clientes'
    ? getAllowedBaseIdsForMember(member)
    : [];

  await executor(
    `
    INSERT INTO team_members (
      id, name, registration, password_hash, role, allowed_base_ids, rating, services_count, status, avatar, efficiency, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,NOW())
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      registration = EXCLUDED.registration,
      password_hash = EXCLUDED.password_hash,
      role = EXCLUDED.role,
      allowed_base_ids = EXCLUDED.allowed_base_ids,
      rating = EXCLUDED.rating,
      services_count = EXCLUDED.services_count,
      status = EXCLUDED.status,
      avatar = EXCLUDED.avatar,
      efficiency = EXCLUDED.efficiency,
      updated_at = NOW()
    `,
    [
      member.id,
      member.name,
      registration,
      passwordHash,
      member.role,
      JSON.stringify(allowedBaseIds),
      member.rating || 5,
      member.servicesCount || 0,
      member.status || 'active',
      member.avatar || currentMember.rows[0]?.avatar || '',
      member.efficiency || '100%',
    ]
  );
}

async function createAuthSession(memberId) {
  const token = randomBytes(32).toString('hex');
  const result = await query(
    `
    INSERT INTO auth_sessions (token, member_id, expires_at)
    VALUES ($1, $2, NOW() + ($3 || ' days')::interval)
    RETURNING expires_at
    `,
    [token, memberId, String(authSessionDays)]
  );

  return {
    token,
    expiresAt: result.rows[0].expires_at,
  };
}

async function getSessionUser(token) {
  if (!token) {
    return null;
  }

  const result = await query(
    `
    SELECT t.*, s.expires_at
    FROM auth_sessions s
    JOIN team_members t ON t.id = s.member_id
    WHERE s.token = $1
    LIMIT 1
    `,
    [token]
  );

  const session = result.rows[0];
  if (!session) {
    return null;
  }

  if (new Date(session.expires_at).getTime() <= Date.now()) {
    await query('DELETE FROM auth_sessions WHERE token = $1', [token]);
    return null;
  }

  return session;
}

async function upsertAppointmentRow(appointment, executor = query) {
  const duplicate = await executor(
    `
    SELECT id
    FROM appointments
    WHERE UPPER(plate) = UPPER($1)
      AND date = $2
      AND time = $3
      AND status IN ('confirmed', 'pending')
      AND id <> $4
    LIMIT 1
    `,
    [appointment.plate, appointment.date, appointment.time, appointment.id]
  );

  if (duplicate.rows[0]) {
    const error = new Error('Ja existe um agendamento para esta placa neste mesmo horario.');
    error.statusCode = 409;
    throw error;
  }

  try {
    await executor(
      `
      INSERT INTO appointments (
        id, customer, vehicle, plate, base_id, base_name, vehicle_type, service, date, time, status, photo, third_party_name, third_party_cpf, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())
      ON CONFLICT (id) DO UPDATE SET
        customer = EXCLUDED.customer,
        vehicle = EXCLUDED.vehicle,
        plate = EXCLUDED.plate,
        base_id = EXCLUDED.base_id,
        base_name = EXCLUDED.base_name,
        vehicle_type = EXCLUDED.vehicle_type,
        service = EXCLUDED.service,
        date = EXCLUDED.date,
        time = EXCLUDED.time,
        status = EXCLUDED.status,
        photo = EXCLUDED.photo,
        third_party_name = EXCLUDED.third_party_name,
        third_party_cpf = EXCLUDED.third_party_cpf,
        updated_at = NOW()
      `,
      [
        appointment.id,
        appointment.customer,
        appointment.vehicle,
        appointment.plate,
        appointment.baseId || null,
        appointment.baseName || null,
        appointment.vehicleType || null,
        appointment.service,
        appointment.date,
        appointment.time,
        appointment.status,
        appointment.photo || null,
        appointment.thirdPartyName || null,
        appointment.thirdPartyCpf || null,
      ]
    );
  } catch (error) {
    if (error.code === '23505') {
      const duplicateError = new Error('Ja existe um agendamento para esta placa neste mesmo horario.');
      duplicateError.statusCode = 409;
      throw duplicateError;
    }

    throw error;
  }
}

app.use(async (req, res, next) => {
  if (!req.path.startsWith('/api/')) {
    return next();
  }

  if (req.method === 'OPTIONS') {
    return next();
  }

  if (req.path === '/api/health' || req.path === '/api/auth/login') {
    return next();
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const sessionUser = await getSessionUser(token);

  if (!sessionUser) {
    return res.status(401).json({ error: 'Sua sessao expirou. Faca login novamente.' });
  }

  req.user = toCamelTeam(sessionUser);
  next();
});

app.get('/api/health', async (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/auth/login', async (req, res) => {
  const { registration, password } = req.body || {};
  if (!registration || !password) {
    return res.status(400).json({ error: 'Matricula e senha sao obrigatorias.' });
  }
  const result = await query('SELECT * FROM team_members WHERE registration = $1', [registration]);
  const member = result.rows[0];
  if (!member) {
    return res.status(401).json({ error: 'Credenciais invalidas.' });
  }
  const isValid = await bcrypt.compare(password, member.password_hash);
  if (!isValid) {
    return res.status(401).json({ error: 'Credenciais invalidas.' });
  }
  const session = await createAuthSession(member.id);
  res.json({ user: toCamelTeam(member), token: session.token, expiresAt: session.expiresAt });
});

app.post('/api/auth/logout', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (token) {
    await query('DELETE FROM auth_sessions WHERE token = $1', [token]);
  }

  res.status(204).end();
});

app.post('/api/assistant/tips', async (req, res) => {
  const { query: question } = req.body || {};
  if (!question?.trim()) {
    return res.status(400).json({ error: 'Informe uma pergunta para o assistente.' });
  }

  const text = await getAssistantTips(question.trim());
  res.json({ text });
});

app.get('/api/assistant/weather', async (req, res) => {
  const location = typeof req.query.location === 'string' ? req.query.location : 'Manaus';
  const text = await getAssistantWeather(location);
  res.json({ text });
});

app.get('/api/bootstrap', async (req, res) => {
  const baseFilter = getBaseFilterForUser(req.user);
  const [serviceTypesResult, accessRulesResult, servicesResult, appointmentsResult, productsResult, teamResult] = await Promise.all([
    query("SELECT value FROM app_settings WHERE key = 'service_types'"),
    query("SELECT value FROM app_settings WHERE key = 'access_rules'"),
    query(`SELECT * FROM services ORDER BY ${servicesOrderSql}`),
    query('SELECT * FROM appointments ORDER BY date DESC, time DESC'),
    query('SELECT * FROM products ORDER BY name'),
    query('SELECT * FROM team_members ORDER BY name'),
  ]);

  const services = servicesResult.rows
    .filter((row) => !baseFilter || baseFilter.includes(row.base_id))
    .map((row) => toCamelService(row, { includePhotos: false }));
  const appointments = appointmentsResult.rows
    .filter((row) => !baseFilter || baseFilter.includes(row.base_id))
    .map(toCamelAppointment);

  res.json({
    currentUser: toCamelTeam(req.user),
    serviceTypes: serviceTypesResult.rows[0]?.value || {},
    accessRules: accessRulesResult.rows[0]?.value || [],
    services,
    appointments,
    products: req.user?.role === 'Clientes' ? [] : productsResult.rows.map(toCamelProduct),
    team: req.user?.role === 'Clientes' ? [] : teamResult.rows.map(toCamelTeam),
  });
});

app.put('/api/access-rules', async (req, res) => {
  const value = Array.isArray(req.body) ? req.body : [];
  await query(
    `
    INSERT INTO app_settings (key, value, updated_at)
    VALUES ('access_rules', $1::jsonb, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `,
    [JSON.stringify(value)]
  );
  res.json(value);
});

app.put('/api/service-types', async (req, res) => {
  const value = req.body;
  await query(
    `
    INSERT INTO app_settings (key, value, updated_at)
    VALUES ('service_types', $1::jsonb, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `,
    [JSON.stringify(value)]
  );
  res.json(value);
});

app.get('/api/vehicles', async (_req, res) => {
  const result = await query('SELECT * FROM vehicles ORDER BY plate');
  res.json(result.rows.map(toCamelVehicle));
});

app.get('/api/vehicles/lookup', async (req, res) => {
  const plate = String(req.query.plate || '').toUpperCase().trim();
  if (!plate) {
    return res.status(400).json({ error: 'Informe a placa para consulta.' });
  }

  const result = await query('SELECT * FROM vehicles WHERE UPPER(plate) = UPPER($1) LIMIT 1', [plate]);
  const row = result.rows[0];

  if (!row) {
    return res.status(404).json({ error: 'Placa nao encontrada na base cadastrada.' });
  }

  res.json(toCamelVehicle(row));
});

app.post('/api/vehicles/upsert', async (req, res) => {
  const vehicle = req.body || {};
  await upsertVehicleRow(vehicle);
  const result = await query('SELECT * FROM vehicles WHERE plate = $1', [String(vehicle.plate || '').toUpperCase().trim()]);
  res.json(toCamelVehicle(result.rows[0]));
});

app.delete('/api/vehicles/:plate', async (req, res) => {
  await query('DELETE FROM vehicles WHERE plate = $1', [String(req.params.plate || '').toUpperCase().trim()]);
  res.status(204).end();
});

app.put('/api/vehicles', async (req, res) => {
  const vehicles = Array.isArray(req.body) ? req.body : [];
  await withTransaction(async (client) => {
    const executor = (text, params = []) => client.query(text, params);
    const plates = vehicles
      .map((vehicle) => String(vehicle.plate || '').toUpperCase().trim())
      .filter(Boolean);

    if (plates.length) {
      await executor('DELETE FROM vehicles WHERE NOT (plate = ANY($1::text[]))', [plates]);
    } else {
      await executor('DELETE FROM vehicles');
    }

    for (const vehicle of vehicles) {
      await upsertVehicleRow(vehicle, executor);
    }
  });
  res.json({ count: vehicles.length });
});

app.get('/api/services', async (req, res) => {
  const result = await query(`SELECT * FROM services ORDER BY ${servicesOrderSql}`);
  const baseFilter = getBaseFilterForUser(req.user);
  res.json(
    result.rows
      .filter((row) => !baseFilter || baseFilter.includes(row.base_id))
      .map((row) => toCamelService(row, { includePhotos: false }))
  );
});

app.get('/api/services/:id', async (req, res) => {
  const result = await query('SELECT * FROM services WHERE id = $1', [req.params.id]);
  const row = result.rows[0];

  if (!row) {
    return res.status(404).json({ error: 'Servico nao encontrado.' });
  }

  assertUserCanAccessBase(req.user, row.base_id);

  res.json(toCamelService(row));
});

app.post('/api/services/upsert', async (req, res) => {
  const service = req.body || {};
  if (!service.id) {
    return res.status(400).json({ error: 'Id do servico e obrigatorio.' });
  }

  assertUserCanAccessBase(req.user, service.baseId || null);

  await upsertServiceRow(service);
  const result = await query('SELECT * FROM services WHERE id = $1', [service.id]);
  res.json(toCamelService(result.rows[0]));
});

app.post('/api/scheduling/book', async (req, res) => {
  const { appointment, service } = req.body || {};

  if (!appointment?.id || !service?.id) {
    return res.status(400).json({ error: 'Agendamento e servico sao obrigatorios.' });
  }

  const requestedBaseId = appointment.baseId || service.baseId || null;
  assertUserCanAccessBase(req.user, requestedBaseId);

  const payload = await withTransaction(async (client) => {
    const executor = (text, params = []) => client.query(text, params);

    await upsertAppointmentRow(appointment, executor);
    await upsertServiceRow(service, executor);

    const [appointmentResult, serviceResult] = await Promise.all([
      client.query('SELECT * FROM appointments WHERE id = $1', [appointment.id]),
      client.query('SELECT * FROM services WHERE id = $1', [service.id]),
    ]);

    return {
      appointment: toCamelAppointment(appointmentResult.rows[0]),
      service: toCamelService(serviceResult.rows[0]),
    };
  });

  res.json(payload);
});

app.delete('/api/services/:id', async (req, res) => {
  const existing = await query('SELECT base_id FROM services WHERE id = $1', [req.params.id]);
  const row = existing.rows[0];
  if (row) {
    assertUserCanAccessBase(req.user, row.base_id);
  }
  await query('DELETE FROM services WHERE id = $1', [req.params.id]);
  res.status(204).end();
});

app.put('/api/services', async (req, res) => {
  const services = Array.isArray(req.body) ? req.body : [];
  await withTransaction(async (client) => {
    const executor = (text, params = []) => client.query(text, params);
    const ids = services.map((service) => service.id).filter(Boolean);

    if (ids.length) {
      await executor('DELETE FROM services WHERE NOT (id = ANY($1::text[]))', [ids]);
    } else {
      await executor('DELETE FROM services');
    }

    for (const service of services) {
      await upsertServiceRow(service, executor);
    }
  });
  res.json({ count: services.length });
});

app.get('/api/appointments', async (req, res) => {
  const result = await query('SELECT * FROM appointments ORDER BY date DESC, time DESC');
  const baseFilter = getBaseFilterForUser(req.user);
  res.json(result.rows.filter((row) => !baseFilter || baseFilter.includes(row.base_id)).map(toCamelAppointment));
});

app.post('/api/appointments/upsert', async (req, res) => {
  const appointment = req.body || {};
  if (!appointment.id) {
    return res.status(400).json({ error: 'Id do agendamento e obrigatorio.' });
  }

  assertUserCanAccessBase(req.user, appointment.baseId || null);

  await upsertAppointmentRow(appointment);
  const result = await query('SELECT * FROM appointments WHERE id = $1', [appointment.id]);
  res.json(toCamelAppointment(result.rows[0]));
});

app.delete('/api/appointments/:id', async (req, res) => {
  const existing = await query('SELECT base_id FROM appointments WHERE id = $1', [req.params.id]);
  const row = existing.rows[0];
  if (row) {
    assertUserCanAccessBase(req.user, row.base_id);
  }
  await query('DELETE FROM appointments WHERE id = $1', [req.params.id]);
  res.status(204).end();
});

app.put('/api/appointments', async (req, res) => {
  const appointments = Array.isArray(req.body) ? req.body : [];
  await withTransaction(async (client) => {
    const executor = (text, params = []) => client.query(text, params);
    const ids = appointments.map((appointment) => appointment.id).filter(Boolean);

    if (ids.length) {
      await executor('DELETE FROM appointments WHERE NOT (id = ANY($1::text[]))', [ids]);
    } else {
      await executor('DELETE FROM appointments');
    }

    for (const appointment of appointments) {
      await upsertAppointmentRow(appointment, executor);
    }
  });
  res.json({ count: appointments.length });
});

app.get('/api/products', async (_req, res) => {
  const result = await query('SELECT * FROM products ORDER BY name');
  res.json(result.rows.map(toCamelProduct));
});

app.post('/api/products/upsert', async (req, res) => {
  const product = req.body || {};
  if (!product.id) {
    return res.status(400).json({ error: 'Id do produto e obrigatorio.' });
  }

  await upsertProductRow(product);
  const result = await query('SELECT * FROM products WHERE id = $1', [product.id]);
  res.json(toCamelProduct(result.rows[0]));
});

app.delete('/api/products/:id', async (req, res) => {
  await query('DELETE FROM products WHERE id = $1', [req.params.id]);
  res.status(204).end();
});

app.put('/api/products', async (req, res) => {
  const products = Array.isArray(req.body) ? req.body : [];
  await withTransaction(async (client) => {
    const executor = (text, params = []) => client.query(text, params);
    const ids = products.map((product) => product.id).filter(Boolean);

    if (ids.length) {
      await executor('DELETE FROM products WHERE NOT (id = ANY($1::text[]))', [ids]);
    } else {
      await executor('DELETE FROM products');
    }

    for (const product of products) {
      await upsertProductRow(product, executor);
    }
  });
  res.json({ count: products.length });
});

app.get('/api/team-members', async (_req, res) => {
  const result = await query('SELECT * FROM team_members ORDER BY name');
  res.json(result.rows.map(toCamelTeam));
});

app.post('/api/team-members/upsert', async (req, res) => {
  const member = req.body || {};
  if (!member.id) {
    return res.status(400).json({ error: 'Id do colaborador e obrigatorio.' });
  }

  await upsertTeamMemberRow(member);
  const result = await query('SELECT * FROM team_members WHERE id = $1', [member.id]);
  res.json(toCamelTeam(result.rows[0]));
});

app.delete('/api/team-members/:id', async (req, res) => {
  await query('DELETE FROM team_members WHERE id = $1', [req.params.id]);
  res.status(204).end();
});

app.put('/api/team-members', async (req, res) => {
  const team = Array.isArray(req.body) ? req.body : [];
  await withTransaction(async (client) => {
    const executor = (text, params = []) => client.query(text, params);
    const ids = team.map((member) => member.id).filter(Boolean);

    if (ids.length) {
      await executor('DELETE FROM auth_sessions WHERE NOT (member_id = ANY($1::text[]))', [ids]);
      await executor('DELETE FROM team_members WHERE NOT (id = ANY($1::text[]))', [ids]);
    } else {
      await executor('DELETE FROM auth_sessions');
      await executor('DELETE FROM team_members');
    }

    for (const member of team) {
      await upsertTeamMemberRow(member, executor);
    }
  });
  res.json({ count: team.length });
});

app.use((error, _req, res, _next) => {
  console.error(error);

  if (error?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'As fotos enviadas ficaram muito grandes. Tente novamente com menos imagens ou imagens menores.' });
  }

  res.status(error.statusCode || 500).json({ error: error.message || 'Erro interno no servidor.' });
});

runSchema()
  .then(() => {
    app.listen(port, () => {
      console.log(`API running on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error('Failed to start API', error);
    process.exit(1);
  });
