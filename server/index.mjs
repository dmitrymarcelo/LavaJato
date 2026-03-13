import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import compression from 'compression';
import { pool, query, withTransaction } from './db.mjs';
import { seedDatabase } from './seed.mjs';
import { getAssistantTips, getAssistantWeather } from './assistant.mjs';
import { mapSourceVehicleTypeToCategory, normalizeSourceVehicleType } from './vehicle-type.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STORAGE_DIR = path.join(__dirname, 'storage');
const UPLOADS_DIR = path.join(STORAGE_DIR, 'uploads');
const DATA_URL_PATTERN = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/;
const IMAGE_EXTENSION_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

const app = express();
const port = Number(process.env.API_PORT || 4000);
const authSessionDays = Number(process.env.AUTH_SESSION_DAYS || 7);
const ALL_BASE_IDS = ['flores', 'sao-jose', 'cidade-nova', 'ponta-negra', 'taruma'];
const TARUMA_ZONE_NAMES = {
  dique_leve: 'Dique Leve',
  dique_pesada: 'Dique Pesada',
  estacionamento: 'Estacionamentos',
};
const OPERATIONAL_SERVICE_STATUSES = ['pending', 'in_progress', 'waiting_payment'];

function inferTarumaZoneId(vehicleType) {
  return vehicleType === 'truck' ? 'dique_pesada' : 'dique_leve';
}

async function cleanupOrphanActiveAppointments(executor = query) {
  await executor(
    `
    DELETE FROM appointments a
    WHERE a.status IN ('confirmed', 'pending')
      AND NOT EXISTS (
        SELECT 1
        FROM services s
        WHERE s.status = 'pending'
          AND (
            s.id = a.id
            OR (
              UPPER(s.plate) = UPPER(a.plate)
              AND s.scheduled_date = a.date
              AND s.scheduled_time = a.time
              AND COALESCE(s.base_id, '') = COALESCE(a.base_id, '')
            )
          )
      )
    `
  );
}

async function syncAppointmentStatuses(executor = query) {
  await executor(
    `
    WITH related_services AS (
      SELECT
        a.id AS appointment_id,
        related.status AS service_status
      FROM appointments a
      JOIN LATERAL (
        SELECT s.status
        FROM services s
        WHERE s.id = a.id
           OR (
             UPPER(s.plate) = UPPER(a.plate)
             AND s.scheduled_date = a.date
             AND s.scheduled_time = a.time
             AND COALESCE(s.base_id, '') = COALESCE(a.base_id, '')
           )
        ORDER BY
          CASE
            WHEN s.id = a.id THEN 0
            ELSE 1
          END,
          CASE s.status
            WHEN 'pending' THEN 1
            WHEN 'in_progress' THEN 2
            WHEN 'waiting_payment' THEN 3
            WHEN 'completed' THEN 4
            WHEN 'no_show' THEN 5
            ELSE 6
          END,
          s.updated_at DESC,
          s.created_at DESC
        LIMIT 1
      ) AS related ON TRUE
    )
    UPDATE appointments a
    SET
      status = CASE related_services.service_status
        WHEN 'pending' THEN CASE WHEN a.status IN ('confirmed', 'pending') THEN a.status ELSE 'confirmed' END
        WHEN 'in_progress' THEN 'in_progress'
        WHEN 'waiting_payment' THEN 'waiting_payment'
        WHEN 'completed' THEN 'completed'
        WHEN 'no_show' THEN 'no_show'
        ELSE a.status
      END,
      updated_at = NOW()
    FROM related_services
    WHERE a.id = related_services.appointment_id
      AND a.status IS DISTINCT FROM CASE related_services.service_status
        WHEN 'pending' THEN CASE WHEN a.status IN ('confirmed', 'pending') THEN a.status ELSE 'confirmed' END
        WHEN 'in_progress' THEN 'in_progress'
        WHEN 'waiting_payment' THEN 'waiting_payment'
        WHEN 'completed' THEN 'completed'
        WHEN 'no_show' THEN 'no_show'
        ELSE a.status
      END
    `
  );
}

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

app.use(cors());
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '30d' }));

function sanitizeUploadScope(scope = 'general') {
  return String(scope || 'general')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9/_-]/g, '')
    .replace(/\/{2,}/g, '/')
    .replace(/^\/|\/$/g, '') || 'general';
}

async function persistUploadedImage(value, scope = 'general') {
  if (!value) {
    return null;
  }

  const normalized = String(value).trim();
  if (!normalized) {
    return null;
  }

  if (normalized.startsWith('/uploads/') || /^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  const match = normalized.match(DATA_URL_PATTERN);
  if (!match) {
    return normalized;
  }

  const mimeType = match[1].toLowerCase();
  const base64Payload = match[2];
  const extension = IMAGE_EXTENSION_BY_MIME[mimeType] || 'jpg';
  const scopePath = sanitizeUploadScope(scope).split('/').filter(Boolean);
  const targetDir = path.join(UPLOADS_DIR, ...scopePath);
  const fileName = `${Date.now()}-${randomBytes(8).toString('hex')}.${extension}`;

  await fs.promises.mkdir(targetDir, { recursive: true });
  await fs.promises.writeFile(path.join(targetDir, fileName), Buffer.from(base64Payload, 'base64'));

  return `/uploads/${[...scopePath, fileName].join('/')}`;
}

async function persistPhotoMap(photos, scope) {
  if (!photos || typeof photos !== 'object') {
    return {};
  }

  const entries = await Promise.all(
    Object.entries(photos).map(async ([key, value]) => [
      key,
      await persistUploadedImage(value, `${scope}/${key}`),
    ])
  );

  return Object.fromEntries(entries.filter(([, value]) => Boolean(value)));
}

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

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
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

function toSortableDateTime(value) {
  if (!value) {
    return '';
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const normalized = String(value).trim();
  if (!normalized) {
    return '';
  }

  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  return normalized;
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
    washingZoneId: row.washing_zone_id,
    washingZoneName: row.washing_zone_name,
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
    sourceVehicleType: row.source_vehicle_type,
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
    email: row.email || '',
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
    washingZoneId: row.washing_zone_id,
    washingZoneName: row.washing_zone_name,
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

function getServiceEventDate(service) {
  return toSortableDateTime(
    service.timeline?.completedAt
    || service.timeline?.noShowAt
    || service.timeline?.paymentCompletedAt
    || service.timeline?.washCompletedAt
    || service.endTime
    || service.startTime
    || `${service.scheduledDate || ''}T${service.scheduledTime || '00:00'}`
  );
}

function buildVehicleHistoryGroups(services, vehicles) {
  const serviceMap = new Map();

  services.forEach((service) => {
    const key = String(service.plate || '').toUpperCase();
    const current = serviceMap.get(key) || [];
    current.push(service);
    serviceMap.set(key, current);
  });

  const groups = [];
  const knownPlates = new Set();

  vehicles.forEach((vehicle) => {
    const plate = String(vehicle.plate || '').toUpperCase();
    knownPlates.add(plate);
    const records = [...(serviceMap.get(plate) || [])].sort((left, right) =>
      getServiceEventDate(right).localeCompare(getServiceEventDate(left))
    );
    const latestRecord = records[0];

    groups.push({
      plate,
      customer: latestRecord?.customer || vehicle.customer || 'Nao informado',
      model: latestRecord?.model || vehicle.model || 'Veiculo nao informado',
      type: latestRecord?.type || vehicle.type,
      previewImage: latestRecord?.image || null,
      records,
      completedCount: records.filter((item) => item.status === 'completed').length,
      noShowCount: records.filter((item) => item.status === 'no_show').length,
      activeCount: records.filter((item) => ['pending', 'in_progress', 'waiting_payment'].includes(item.status)).length,
      totalRevenue: records
        .filter((item) => item.status === 'completed')
        .reduce((total, item) => total + Number(item.price || 0), 0),
      lastRecordedAt: latestRecord ? getServiceEventDate(latestRecord) : null,
      lastBaseName: latestRecord?.baseName || null,
    });
  });

  serviceMap.forEach((records, plate) => {
    if (knownPlates.has(plate)) {
      return;
    }

    const sortedRecords = [...records].sort((left, right) =>
      getServiceEventDate(right).localeCompare(getServiceEventDate(left))
    );
    const latestRecord = sortedRecords[0];

    groups.push({
      plate,
      customer: latestRecord?.customer || 'Nao informado',
      model: latestRecord?.model || 'Veiculo nao informado',
      type: latestRecord?.type || null,
      previewImage: latestRecord?.image || null,
      records: sortedRecords,
      completedCount: sortedRecords.filter((item) => item.status === 'completed').length,
      noShowCount: sortedRecords.filter((item) => item.status === 'no_show').length,
      activeCount: sortedRecords.filter((item) => ['pending', 'in_progress', 'waiting_payment'].includes(item.status)).length,
      totalRevenue: sortedRecords
        .filter((item) => item.status === 'completed')
        .reduce((total, item) => total + Number(item.price || 0), 0),
      lastRecordedAt: latestRecord ? getServiceEventDate(latestRecord) : null,
      lastBaseName: latestRecord?.baseName || null,
    });
  });

  return groups.sort((left, right) => {
    const rightDate = right.lastRecordedAt || '';
    const leftDate = left.lastRecordedAt || '';
    if (rightDate !== leftDate) {
      return rightDate.localeCompare(leftDate);
    }
    return left.plate.localeCompare(right.plate);
  });
}

async function runSchema() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
  await migrateInlineImages();
  await seedDatabase();
}

function hasInlineImage(value) {
  return typeof value === 'string' && DATA_URL_PATTERN.test(value.trim());
}

async function migrateInlineImages() {
  const [servicesResult, productsResult, teamResult, appointmentsResult] = await Promise.all([
    query('SELECT id, image, pre_inspection_photos, post_inspection_photos FROM services'),
    query('SELECT id, image FROM products'),
    query('SELECT id, avatar FROM team_members'),
    query('SELECT id, photo FROM appointments'),
  ]);

  for (const row of servicesResult.rows) {
    const originalPrePhotos = row.pre_inspection_photos || {};
    const originalPostPhotos = row.post_inspection_photos || {};
    const nextImage = await persistUploadedImage(row.image, 'services/preview');
    const nextPrePhotos = await persistPhotoMap(originalPrePhotos, 'checklists/pre');
    const nextPostPhotos = await persistPhotoMap(originalPostPhotos, 'checklists/post');

    if (
      nextImage !== row.image
      || JSON.stringify(nextPrePhotos) !== JSON.stringify(originalPrePhotos)
      || JSON.stringify(nextPostPhotos) !== JSON.stringify(originalPostPhotos)
    ) {
      await query(
        `
        UPDATE services
        SET image = $2,
            pre_inspection_photos = $3::jsonb,
            post_inspection_photos = $4::jsonb,
            updated_at = NOW()
        WHERE id = $1
        `,
        [row.id, nextImage, JSON.stringify(nextPrePhotos), JSON.stringify(nextPostPhotos)]
      );
    }
  }

  for (const row of productsResult.rows) {
    if (!hasInlineImage(row.image)) {
      continue;
    }

    const nextImage = await persistUploadedImage(row.image, 'products');
    if (nextImage !== row.image) {
      await query('UPDATE products SET image = $2, updated_at = NOW() WHERE id = $1', [row.id, nextImage]);
    }
  }

  for (const row of teamResult.rows) {
    if (!hasInlineImage(row.avatar)) {
      continue;
    }

    const nextAvatar = await persistUploadedImage(row.avatar, 'avatars');
    if (nextAvatar !== row.avatar) {
      await query('UPDATE team_members SET avatar = $2, updated_at = NOW() WHERE id = $1', [row.id, nextAvatar]);
    }
  }

  for (const row of appointmentsResult.rows) {
    if (!hasInlineImage(row.photo)) {
      continue;
    }

    const nextPhoto = await persistUploadedImage(row.photo, 'appointments');
    if (nextPhoto !== row.photo) {
      await query('UPDATE appointments SET photo = $2, updated_at = NOW() WHERE id = $1', [row.id, nextPhoto]);
    }
  }
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

function requiresCarryOverObservation(service) {
  const createdDate = toDateKey(service?.timeline?.createdAt);
  const scheduledDate = toDateKey(service?.scheduledDate);

  return Boolean(createdDate && scheduledDate && createdDate < scheduledDate);
}

function assertCarryOverObservation(service) {
  if (service?.status !== 'in_progress') {
    return;
  }

  if (!requiresCarryOverObservation(service)) {
    return;
  }

  if (String(service?.observations || '').trim().length >= 10) {
    return;
  }

  const error = new Error('Informe uma observacao descritiva antes de iniciar a lavagem deste agendamento anterior.');
  error.statusCode = 400;
  throw error;
}

function normalizeTarumaZone(baseId, vehicleType, washingZoneId) {
  if (baseId !== 'taruma') {
    return {
      washingZoneId: null,
      washingZoneName: null,
    };
  }

  const normalizedZoneId = String(washingZoneId || '').trim();
  if (!normalizedZoneId) {
    const inferredZoneId = inferTarumaZoneId(vehicleType);
    return {
      washingZoneId: inferredZoneId,
      washingZoneName: TARUMA_ZONE_NAMES[inferredZoneId],
    };
  }

  if (!TARUMA_ZONE_NAMES[normalizedZoneId]) {
    const error = new Error('Selecione uma area de lavagem valida da Base Taruma.');
    error.statusCode = 400;
    throw error;
  }

  if (normalizedZoneId === 'dique_pesada' && vehicleType !== 'truck') {
    const error = new Error('Dique Pesada da Base Taruma atende somente caminhoes.');
    error.statusCode = 400;
    throw error;
  }

  if (normalizedZoneId === 'dique_leve' && vehicleType === 'truck') {
    const error = new Error('Caminhoes devem ser direcionados para Dique Pesada ou Estacionamentos.');
    error.statusCode = 400;
    throw error;
  }

  return {
    washingZoneId: normalizedZoneId,
    washingZoneName: TARUMA_ZONE_NAMES[normalizedZoneId],
  };
}

async function upsertServiceRow(service, executor = query) {
  assertCarryOverObservation(service);
  const persistedPreInspectionPhotos = await persistPhotoMap(service.preInspectionPhotos, 'checklists/pre');
  const persistedPostInspectionPhotos = await persistPhotoMap(service.postInspectionPhotos, 'checklists/post');
  const persistedPreviewImage = await persistUploadedImage(service.image || null, 'services/preview');

  await executor(
    `
    INSERT INTO services (
      id, sort_order, plate, model, type, base_id, base_name, washing_zone_id, washing_zone_name, scheduled_date, scheduled_time, status, price, priority, customer,
      third_party_name, third_party_cpf, observations, washer, washers, timeline, pre_inspection_photos, post_inspection_photos, start_time, end_time, image, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20::jsonb,$21::jsonb,$22::jsonb,$23::jsonb,$24,$25,$26,NOW())
    ON CONFLICT (id) DO UPDATE SET
      sort_order = EXCLUDED.sort_order,
      plate = EXCLUDED.plate,
      model = EXCLUDED.model,
      type = EXCLUDED.type,
      base_id = EXCLUDED.base_id,
      base_name = EXCLUDED.base_name,
      washing_zone_id = EXCLUDED.washing_zone_id,
      washing_zone_name = EXCLUDED.washing_zone_name,
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
      service.washingZoneId || null,
      service.washingZoneName || null,
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
      JSON.stringify(persistedPreInspectionPhotos),
      JSON.stringify(persistedPostInspectionPhotos),
      service.startTime || null,
      service.endTime || null,
      persistedPreviewImage,
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

  const sourceVehicleType = normalizeSourceVehicleType(vehicle.sourceVehicleType);
  const normalizedType = sourceVehicleType
    ? mapSourceVehicleTypeToCategory(sourceVehicleType)
    : vehicle.type;

  await executor(
    `
    INSERT INTO vehicles (
      plate, customer, model, type, source_vehicle_type, city, state, last_service, third_party_name, third_party_cpf, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
    ON CONFLICT (plate) DO UPDATE SET
      customer = EXCLUDED.customer,
      model = EXCLUDED.model,
      type = EXCLUDED.type,
      source_vehicle_type = EXCLUDED.source_vehicle_type,
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
      normalizedType,
      sourceVehicleType || null,
      vehicle.city || null,
      vehicle.state || null,
      vehicle.lastService || null,
      vehicle.thirdPartyName || null,
      vehicle.thirdPartyCpf || null,
    ]
  );
}

async function upsertProductRow(product, executor = query) {
  const persistedProductImage = await persistUploadedImage(product.image || null, 'products');

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
      persistedProductImage,
      JSON.stringify(Array.isArray(product.manualEntries) ? product.manualEntries : []),
      JSON.stringify(Array.isArray(product.manualOutputs) ? product.manualOutputs : []),
    ]
  );
}

async function upsertTeamMemberRow(member, executor = query) {
  const normalizedEmail = normalizeEmail(member.email);
  const isClientRole = member.role === 'Clientes';
  const registration = isClientRole
    ? String(member.registration || '').trim() || `CLI-${Date.now()}-${randomBytes(3).toString('hex')}`
    : String(member.registration || '').trim();

  if (!isClientRole && !registration) {
    const error = new Error('Matricula do colaborador e obrigatoria.');
    error.statusCode = 400;
    throw error;
  }

  if (isClientRole && !normalizedEmail) {
    const error = new Error('Email do cliente e obrigatorio.');
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

  if (normalizedEmail) {
    const duplicateEmail = await executor(
      `
      SELECT id
      FROM team_members
      WHERE LOWER(COALESCE(email, '')) = $1
        AND id <> $2
      LIMIT 1
      `,
      [normalizedEmail, member.id]
    );

    if (duplicateEmail.rows[0]) {
      const error = new Error('Ja existe um usuario com este email.');
      error.statusCode = 409;
      throw error;
    }
  }

  const currentMember = await executor('SELECT password_hash, avatar FROM team_members WHERE id = $1', [member.id]);
  const passwordHash = member.passwordHash
    || (member.password ? await bcrypt.hash(member.password, 10) : currentMember.rows[0]?.password_hash)
    || await bcrypt.hash('Admin@123456!', 10);
  const allowedBaseIds = isClientRole
    ? getAllowedBaseIdsForMember(member)
    : [];
  const persistedAvatar = await persistUploadedImage(member.avatar || currentMember.rows[0]?.avatar || '', 'avatars');

  await executor(
    `
    INSERT INTO team_members (
      id, name, registration, email, password_hash, role, allowed_base_ids, rating, services_count, status, avatar, efficiency, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,NOW())
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      registration = EXCLUDED.registration,
      email = EXCLUDED.email,
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
      normalizedEmail || null,
      passwordHash,
      member.role,
      JSON.stringify(allowedBaseIds),
      member.rating || 5,
      member.servicesCount || 0,
      member.status || 'active',
      persistedAvatar || '',
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
  const normalizedTarumaZone = normalizeTarumaZone(appointment.baseId || null, appointment.vehicleType || null, appointment.washingZoneId);
  const persistedAppointmentPhoto = await persistUploadedImage(appointment.photo || null, 'appointments');

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
        id, customer, vehicle, plate, base_id, base_name, washing_zone_id, washing_zone_name, vehicle_type, service, date, time, status, photo, third_party_name, third_party_cpf, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW())
      ON CONFLICT (id) DO UPDATE SET
        customer = EXCLUDED.customer,
        vehicle = EXCLUDED.vehicle,
        plate = EXCLUDED.plate,
        base_id = EXCLUDED.base_id,
        base_name = EXCLUDED.base_name,
        washing_zone_id = EXCLUDED.washing_zone_id,
        washing_zone_name = EXCLUDED.washing_zone_name,
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
        normalizedTarumaZone.washingZoneId,
        normalizedTarumaZone.washingZoneName,
        appointment.vehicleType || null,
        appointment.service,
        appointment.date,
        appointment.time,
        appointment.status,
        persistedAppointmentPhoto,
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
  const identifier = String(req.body?.identifier || req.body?.registration || '').trim();
  const password = req.body?.password;

  if (!identifier || !password) {
    return res.status(400).json({ error: 'Matrícula ou email e senha sao obrigatorios.' });
  }
  const result = await query(
    `
    SELECT *
    FROM team_members
    WHERE registration = $1
       OR LOWER(COALESCE(email, '')) = LOWER($1)
    ORDER BY CASE WHEN registration = $1 THEN 0 ELSE 1 END
    LIMIT 1
    `,
    [identifier]
  );
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
  await syncAppointmentStatuses();
  await cleanupOrphanActiveAppointments();
  const baseFilter = getBaseFilterForUser(req.user);
  const [serviceTypesResult, accessRulesResult, servicesResult, appointmentsResult, productsResult, teamResult] = await Promise.all([
    query("SELECT value FROM app_settings WHERE key = 'service_types'"),
    query("SELECT value FROM app_settings WHERE key = 'access_rules'"),
    query(
      `
      SELECT *
      FROM services
      WHERE status = ANY($1::text[])
         OR COALESCE(scheduled_date, start_time::date, end_time::date, created_at::date) >= CURRENT_DATE - INTERVAL '62 days'
      ORDER BY ${servicesOrderSql}
      `,
      [OPERATIONAL_SERVICE_STATUSES]
    ),
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

app.get('/api/vehicle-history', async (req, res) => {
  const baseFilter = getBaseFilterForUser(req.user);
  const [vehiclesResult, servicesResult] = await Promise.all([
    query('SELECT * FROM vehicles ORDER BY plate'),
    query(
      `
      SELECT *
      FROM services
      WHERE status IN ('completed', 'no_show', 'pending', 'in_progress', 'waiting_payment')
      ORDER BY scheduled_date DESC NULLS LAST, updated_at DESC
      `
    ),
  ]);

  const services = servicesResult.rows
    .filter((row) => !baseFilter || baseFilter.includes(row.base_id))
    .map((row) => toCamelService(row, { includePhotos: false }));

  res.json(
    buildVehicleHistoryGroups(services, vehiclesResult.rows.map(toCamelVehicle)).map((group) => ({
      plate: group.plate,
      customer: group.customer,
      model: group.model,
      type: group.type,
      previewImage: group.previewImage,
      recordCount: group.records.length,
      completedCount: group.completedCount,
      noShowCount: group.noShowCount,
      activeCount: group.activeCount,
      totalRevenue: group.totalRevenue,
      lastRecordedAt: group.lastRecordedAt,
      lastBaseName: group.lastBaseName,
    }))
  );
});

app.get('/api/vehicle-history/:plate', async (req, res) => {
  const plate = String(req.params.plate || '').toUpperCase().trim();
  if (!plate) {
    return res.status(400).json({ error: 'Informe a placa do veiculo.' });
  }

  const baseFilter = getBaseFilterForUser(req.user);
  const [vehicleResult, servicesResult] = await Promise.all([
    query('SELECT * FROM vehicles WHERE UPPER(plate) = UPPER($1) LIMIT 1', [plate]),
    query(
      `
      SELECT *
      FROM services
      WHERE UPPER(plate) = UPPER($1)
      ORDER BY scheduled_date DESC NULLS LAST, updated_at DESC
      `,
      [plate]
    ),
  ]);

  const services = servicesResult.rows
    .filter((row) => !baseFilter || baseFilter.includes(row.base_id))
    .map((row) => toCamelService(row, { includePhotos: false }));
  const vehicle = vehicleResult.rows[0] ? toCamelVehicle(vehicleResult.rows[0]) : null;
  const groups = buildVehicleHistoryGroups(services, vehicle ? [vehicle] : []);
  const detail = groups.find((group) => group.plate === plate);

  if (!detail) {
    return res.status(404).json({ error: 'Historico do veiculo nao encontrado.' });
  }

  res.json({
    plate: detail.plate,
    customer: detail.customer,
    model: detail.model,
    type: detail.type,
    previewImage: detail.previewImage,
    recordCount: detail.records.length,
    completedCount: detail.completedCount,
    noShowCount: detail.noShowCount,
    activeCount: detail.activeCount,
    totalRevenue: detail.totalRevenue,
    lastRecordedAt: detail.lastRecordedAt,
    lastBaseName: detail.lastBaseName,
    records: detail.records,
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

app.post('/api/services/:id/complete-payment', async (req, res) => {
  const payload = await withTransaction(async (client) => {
    const executor = (text, params = []) => client.query(text, params);
    const serviceResult = await executor('SELECT * FROM services WHERE id = $1 FOR UPDATE', [req.params.id]);
    const serviceRow = serviceResult.rows[0];

    if (!serviceRow) {
      const error = new Error('Servico nao encontrado.');
      error.statusCode = 404;
      throw error;
    }

    assertUserCanAccessBase(req.user, serviceRow.base_id);

    const currentService = toCamelService(serviceRow);
    const nowIso = new Date().toISOString();
    const nextService = {
      ...currentService,
      status: 'completed',
      timeline: {
        ...(currentService.timeline || {}),
        paymentStartedAt: currentService.timeline?.paymentStartedAt || nowIso,
        paymentCompletedAt: nowIso,
        completedAt: nowIso,
      },
    };

    await upsertServiceRow(nextService, executor);

    const appointmentResult = await executor('SELECT * FROM appointments WHERE id = $1 FOR UPDATE', [req.params.id]);
    let nextAppointment = null;

    if (appointmentResult.rows[0]) {
      nextAppointment = {
        ...toCamelAppointment(appointmentResult.rows[0]),
        status: 'completed',
      };
      await upsertAppointmentRow(nextAppointment, executor);
    }

    const updatedServiceResult = await executor('SELECT * FROM services WHERE id = $1', [req.params.id]);

    return {
      service: toCamelService(updatedServiceResult.rows[0]),
      appointment: nextAppointment,
    };
  });

  res.json(payload);
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

app.delete('/api/scheduling/:id', async (req, res) => {
  const payload = await withTransaction(async (client) => {
    const executor = (text, params = []) => client.query(text, params);
    const appointmentResult = await executor('SELECT * FROM appointments WHERE id = $1 FOR UPDATE', [req.params.id]);
    const serviceResult = await executor('SELECT * FROM services WHERE id = $1 FOR UPDATE', [req.params.id]);
    const appointmentRow = appointmentResult.rows[0] || null;
    const serviceRow = serviceResult.rows[0] || null;

    const referenceBaseId = appointmentRow?.base_id || serviceRow?.base_id || null;
    if (referenceBaseId) {
      assertUserCanAccessBase(req.user, referenceBaseId);
    }

    const referencePlate = appointmentRow?.plate || serviceRow?.plate || null;
    const referenceDate = appointmentRow?.date || serviceRow?.scheduled_date || null;
    const referenceTime = appointmentRow?.time || serviceRow?.scheduled_time || null;

    const deletedAppointmentIds = new Set();
    const deletedServiceIds = new Set();

    if (appointmentRow) {
      await executor('DELETE FROM appointments WHERE id = $1', [appointmentRow.id]);
      deletedAppointmentIds.add(appointmentRow.id);
    }

    if (serviceRow) {
      await executor('DELETE FROM services WHERE id = $1', [serviceRow.id]);
      deletedServiceIds.add(serviceRow.id);
    }

    if (referencePlate && referenceDate && referenceTime) {
      const [relatedAppointmentsResult, relatedServicesResult] = await Promise.all([
        executor(
          `
          SELECT id
          FROM appointments
          WHERE UPPER(plate) = UPPER($1)
            AND date = $2
            AND time = $3
            AND status IN ('confirmed', 'pending')
            AND ($4::text IS NULL OR base_id = $4)
          FOR UPDATE
          `,
          [referencePlate, referenceDate, referenceTime, referenceBaseId]
        ),
        executor(
          `
          SELECT id
          FROM services
          WHERE UPPER(plate) = UPPER($1)
            AND scheduled_date = $2
            AND scheduled_time = $3
            AND status = 'pending'
            AND ($4::text IS NULL OR base_id = $4)
          FOR UPDATE
          `,
          [referencePlate, referenceDate, referenceTime, referenceBaseId]
        ),
      ]);

      for (const row of relatedAppointmentsResult.rows) {
        if (!deletedAppointmentIds.has(row.id)) {
          await executor('DELETE FROM appointments WHERE id = $1', [row.id]);
          deletedAppointmentIds.add(row.id);
        }
      }

      for (const row of relatedServicesResult.rows) {
        if (!deletedServiceIds.has(row.id)) {
          await executor('DELETE FROM services WHERE id = $1', [row.id]);
          deletedServiceIds.add(row.id);
        }
      }
    }

    return {
      deletedAppointmentIds: Array.from(deletedAppointmentIds),
      deletedServiceIds: Array.from(deletedServiceIds),
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

app.get('/api/appointments', async (req, res) => {
  await syncAppointmentStatuses();
  await cleanupOrphanActiveAppointments();
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
