import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import { pool, query } from './db.mjs';
import { seedDatabase } from './seed.mjs';
import { getAssistantTips, getAssistantWeather } from './assistant.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.API_PORT || 4000);

app.use(cors());
app.use(express.json({ limit: '15mb' }));

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

function toCamelService(row) {
  return {
    id: row.id,
    sortOrder: row.sort_order,
    plate: row.plate,
    model: row.model,
    type: row.type,
    baseId: row.base_id,
    baseName: row.base_name,
    scheduledDate: row.scheduled_date,
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
    vehicleType: row.vehicle_type,
    service: row.service,
    date: row.date,
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

async function upsertServiceRow(service) {
  await query(
    `
    INSERT INTO services (
      id, sort_order, plate, model, type, base_id, base_name, scheduled_date, scheduled_time, status, price, priority, customer,
      third_party_name, third_party_cpf, observations, washer, washers, timeline, start_time, end_time, image, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,$19::jsonb,$20,$21,$22,NOW())
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
      service.startTime || null,
      service.endTime || null,
      service.image || null,
    ]
  );
}

async function upsertAppointmentRow(appointment) {
  const duplicate = await query(
    `
    SELECT id
    FROM appointments
    WHERE UPPER(plate) = UPPER($1)
      AND date = $2
      AND time = $3
      AND status <> 'cancelled'
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
    await query(
      `
      INSERT INTO appointments (
        id, customer, vehicle, plate, vehicle_type, service, date, time, status, photo, third_party_name, third_party_cpf, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
      ON CONFLICT (id) DO UPDATE SET
        customer = EXCLUDED.customer,
        vehicle = EXCLUDED.vehicle,
        plate = EXCLUDED.plate,
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
  res.json({ user: toCamelTeam(member) });
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

app.get('/api/bootstrap', async (_req, res) => {
  const [serviceTypesResult, vehiclesResult, servicesResult, appointmentsResult, productsResult, teamResult] = await Promise.all([
    query("SELECT value FROM app_settings WHERE key = 'service_types'"),
    query('SELECT * FROM vehicles ORDER BY plate'),
    query(`SELECT * FROM services ORDER BY ${servicesOrderSql}`),
    query('SELECT * FROM appointments ORDER BY date DESC, time DESC'),
    query('SELECT * FROM products ORDER BY name'),
    query('SELECT * FROM team_members ORDER BY name'),
  ]);

  res.json({
    serviceTypes: serviceTypesResult.rows[0]?.value || {},
    vehicleDb: vehiclesResult.rows.map(toCamelVehicle),
    services: servicesResult.rows.map(toCamelService),
    appointments: appointmentsResult.rows.map(toCamelAppointment),
    products: productsResult.rows.map(toCamelProduct),
    team: teamResult.rows.map(toCamelTeam),
  });
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

app.put('/api/vehicles', async (req, res) => {
  const vehicles = Array.isArray(req.body) ? req.body : [];
  await query('TRUNCATE TABLE vehicles');
  for (const vehicle of vehicles) {
    await query(
      `
      INSERT INTO vehicles (plate, customer, model, type, city, state, last_service, third_party_name, third_party_cpf)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `,
      [
        vehicle.plate,
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
  res.json({ count: vehicles.length });
});

app.get('/api/services', async (_req, res) => {
  const result = await query(`SELECT * FROM services ORDER BY ${servicesOrderSql}`);
  res.json(result.rows.map(toCamelService));
});

app.post('/api/services/upsert', async (req, res) => {
  const service = req.body || {};
  if (!service.id) {
    return res.status(400).json({ error: 'Id do servico e obrigatorio.' });
  }

  await upsertServiceRow(service);
  const result = await query('SELECT * FROM services WHERE id = $1', [service.id]);
  res.json(toCamelService(result.rows[0]));
});

app.delete('/api/services/:id', async (req, res) => {
  await query('DELETE FROM services WHERE id = $1', [req.params.id]);
  res.status(204).end();
});

app.put('/api/services', async (req, res) => {
  const services = Array.isArray(req.body) ? req.body : [];
  await query('TRUNCATE TABLE services');
  for (const service of services) {
    await upsertServiceRow(service);
  }
  res.json({ count: services.length });
});

app.get('/api/appointments', async (_req, res) => {
  const result = await query('SELECT * FROM appointments ORDER BY date DESC, time DESC');
  res.json(result.rows.map(toCamelAppointment));
});

app.post('/api/appointments/upsert', async (req, res) => {
  const appointment = req.body || {};
  if (!appointment.id) {
    return res.status(400).json({ error: 'Id do agendamento e obrigatorio.' });
  }

  await upsertAppointmentRow(appointment);
  const result = await query('SELECT * FROM appointments WHERE id = $1', [appointment.id]);
  res.json(toCamelAppointment(result.rows[0]));
});

app.delete('/api/appointments/:id', async (req, res) => {
  await query('DELETE FROM appointments WHERE id = $1', [req.params.id]);
  res.status(204).end();
});

app.put('/api/appointments', async (req, res) => {
  const appointments = Array.isArray(req.body) ? req.body : [];
  await query('TRUNCATE TABLE appointments');
  for (const appointment of appointments) {
    await upsertAppointmentRow(appointment);
  }
  res.json({ count: appointments.length });
});

app.get('/api/products', async (_req, res) => {
  const result = await query('SELECT * FROM products ORDER BY name');
  res.json(result.rows.map(toCamelProduct));
});

app.put('/api/products', async (req, res) => {
  const products = Array.isArray(req.body) ? req.body : [];
  await query('TRUNCATE TABLE products');
  for (const product of products) {
    await query(
      `
      INSERT INTO products (
        id, name, category, quantity, min_quantity, unit, price, last_restock, status, image, manual_entries, manual_outputs
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
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
  res.json({ count: products.length });
});

app.get('/api/team-members', async (_req, res) => {
  const result = await query('SELECT * FROM team_members ORDER BY name');
  res.json(result.rows.map(toCamelTeam));
});

app.put('/api/team-members', async (req, res) => {
  const team = Array.isArray(req.body) ? req.body : [];
  await query('TRUNCATE TABLE team_members');
  for (const member of team) {
    const passwordHash = member.passwordHash || await bcrypt.hash(member.password || 'Admin@123456!', 10);
    await query(
      `
      INSERT INTO team_members (
        id, name, registration, password_hash, role, rating, services_count, status, avatar, efficiency
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      `,
      [
        member.id,
        member.name,
        member.registration,
        passwordHash,
        member.role,
        member.rating || 5,
        member.servicesCount || 0,
        member.status || 'offline',
        member.avatar,
        member.efficiency || '100%',
      ]
    );
  }
  res.json({ count: team.length });
});

app.use((error, _req, res, _next) => {
  console.error(error);
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
