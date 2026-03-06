import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import { pool, query } from './db.mjs';
import { seedDatabase } from './seed.mjs';

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
  };
}

function toCamelService(row) {
  return {
    id: row.id,
    plate: row.plate,
    model: row.model,
    type: row.type,
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

app.get('/api/bootstrap', async (_req, res) => {
  const [serviceTypesResult, vehiclesResult, servicesResult, appointmentsResult, productsResult, teamResult] = await Promise.all([
    query("SELECT value FROM app_settings WHERE key = 'service_types'"),
    query('SELECT * FROM vehicles ORDER BY plate'),
    query('SELECT * FROM services ORDER BY scheduled_date DESC NULLS LAST, scheduled_time DESC NULLS LAST'),
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
  const result = await query('SELECT * FROM services ORDER BY scheduled_date DESC NULLS LAST, scheduled_time DESC NULLS LAST');
  res.json(result.rows.map(toCamelService));
});

app.put('/api/services', async (req, res) => {
  const services = Array.isArray(req.body) ? req.body : [];
  await query('TRUNCATE TABLE services');
  for (const service of services) {
    await query(
      `
      INSERT INTO services (
        id, plate, model, type, scheduled_date, scheduled_time, status, price, priority, customer,
        third_party_name, third_party_cpf, observations, washer, washers, start_time, end_time, image
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16,$17,$18)
      `,
      [
        service.id,
        service.plate,
        service.model,
        service.type,
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
        service.startTime || null,
        service.endTime || null,
        service.image || null,
      ]
    );
  }
  res.json({ count: services.length });
});

app.get('/api/appointments', async (_req, res) => {
  const result = await query('SELECT * FROM appointments ORDER BY date DESC, time DESC');
  res.json(result.rows.map(toCamelAppointment));
});

app.put('/api/appointments', async (req, res) => {
  const appointments = Array.isArray(req.body) ? req.body : [];
  await query('TRUNCATE TABLE appointments');
  for (const appointment of appointments) {
    await query(
      `
      INSERT INTO appointments (
        id, customer, vehicle, plate, service, date, time, status, photo, third_party_name, third_party_cpf
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      `,
      [
        appointment.id,
        appointment.customer,
        appointment.vehicle,
        appointment.plate,
        appointment.service,
        appointment.date,
        appointment.time,
        appointment.status,
        appointment.photo || null,
        appointment.thirdPartyName || null,
        appointment.thirdPartyCpf || null,
      ]
    );
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
        id, name, category, quantity, min_quantity, unit, price, last_restock, status, image
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
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
  res.status(500).json({ error: error.message || 'Erro interno no servidor.' });
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
