import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import bcrypt from "npm:bcryptjs@3.0.2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const AUTH_SESSION_DAYS = Math.max(1, Number(Deno.env.get("AUTH_SESSION_DAYS") || 7));
const UPLOAD_BUCKET = Deno.env.get("UPLOAD_BUCKET") || "uploads";
const ALL_BASE_IDS = ["flores", "sao-jose", "cidade-nova", "ponta-negra", "taruma"];
const OPERATIONAL_SERVICE_STATUSES = ["pending", "in_progress", "waiting_payment"];
const APP_PERMISSION_IDS = [
  "view_scheduling",
  "manage_scheduling",
  "operate_wash",
  "manage_payments",
  "view_analytics",
  "manage_vehicle_base",
  "manage_inventory",
  "manage_team",
  "edit_services",
  "delete_services",
  "bypass_inspection",
  "manage_access",
  "manage_b2b",
];
const APP_PERMISSION_SET = new Set(APP_PERMISSION_IDS);
const ADMIN_ROLES = new Set(["Administrador"]);

const TARUMA_BASE_ID = "taruma";
const TARUMA_DIQUE_LEVE_ZONE_ID = "dique_leve";
const TARUMA_DIQUE_LEVE_ZONE_NAME = "Dique Leve";
const TARUMA_DEFAULT_SLOT_CAPACITY = 3;
const TARUMA_END_OF_SHIFT_TIME = "17:00";
const TARUMA_END_OF_SHIFT_SLOT_CAPACITY = 1;
const TARUMA_END_OF_SHIFT_TRUCK_SLOT_CAPACITY = 1;
const TARUMA_MAX_TRUCKS_PER_SLOT = 1;
const TARUMA_MAX_OTHERS_PER_SLOT = 2;
const TARUMA_TRUCK_MIN_INTERVAL_MINUTES = 180;
const TARUMA_ACTIVE_APPOINTMENT_STATUSES = ["confirmed", "pending"];
const FLORES_BASE_ID = "flores";
const FLORES_ACTIVE_APPOINTMENT_STATUSES = ["confirmed", "pending"];
const FLORES_CAR_DURATION_MINUTES = 90;
const FLORES_TRUCK_DURATION_MINUTES = 120;
const FLORES_SLOT_GRANULARITY_MINUTES = 30;
const FLORES_WEEKDAY_WORK_WINDOWS = [
  { start: "08:00", end: "12:00" },
  { start: "14:00", end: "18:00" },
];
const FLORES_SATURDAY_WORK_WINDOWS = [{ start: "08:00", end: "12:00" }];

const DATA_URL_PATTERN = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/;
const IMAGE_EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
};

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.");
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

let uploadBucketReady = false;

class ApiError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
  }
}

function fail(message: string, statusCode = 400): never {
  throw new ApiError(statusCode, message);
}

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "no-store",
    "Pragma": "no-cache",
    "X-Content-Type-Options": "nosniff",
    "Vary": "Origin",
  };
}

function jsonResponse(req: Request, payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders(req),
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function emptyResponse(req: Request, status = 204) {
  return new Response(null, {
    status,
    headers: corsHeaders(req),
  });
}

function normalizeFunctionPath(url: URL) {
  const markerIndex = url.pathname.indexOf("/api");
  if (markerIndex >= 0) {
    return url.pathname.slice(markerIndex) || "/api";
  }

  return "/api";
}

async function readJson(req: Request) {
  if (req.method === "GET" || req.method === "HEAD") {
    return {};
  }

  const raw = await req.text();
  if (!raw.trim()) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    fail("JSON invalido.", 400);
  }
}

function getBearerToken(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
}

function randomHex(bytes = 32) {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return Array.from(buffer, (value) => value.toString(16).padStart(2, "0")).join("");
}

function randomIndex(max: number) {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0] % max;
}

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function normalizeDateKey(value: unknown) {
  if (!value) {
    return null;
  }

  const normalized = String(value).trim();
  if (!normalized) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }

  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return normalized.slice(0, 10);
}

function normalizeTime(value: unknown) {
  return String(value || "").slice(0, 5);
}

function normalizeAllowedBaseIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) => String(item || "").trim())
        .filter((item) => ALL_BASE_IDS.includes(item)),
    ),
  );
}

function isValidEmailAddress(value: unknown) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function isStrongPassword(value: unknown) {
  const password = String(value || "");
  return password.length >= 12
    && /[a-z]/.test(password)
    && /[A-Z]/.test(password)
    && /\d/.test(password)
    && /[^A-Za-z0-9]/.test(password);
}

function getStrongPasswordError(value: unknown) {
  return isStrongPassword(value)
    ? null
    : "A senha precisa ter 12+ caracteres com maiuscula, minuscula, numero e simbolo.";
}

function normalizePermissionList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) => String(item || "").trim())
        .filter((item) => APP_PERMISSION_SET.has(item)),
    ),
  );
}

function buildDefaultAccessRules() {
  return [
    {
      role: "Colaboradores",
      permissions: [
        "view_scheduling",
        "manage_scheduling",
        "manage_payments",
        "view_analytics",
        "manage_vehicle_base",
      ],
    },
    { role: "Administrador", permissions: [...APP_PERMISSION_IDS] },
    { role: "Lavador", permissions: ["view_scheduling", "operate_wash"] },
    { role: "Clientes", permissions: ["manage_b2b"] },
  ];
}

function normalizeAccessRules(value: unknown) {
  const providedRules = Array.isArray(value)
    ? value
      .map((rule) => ({
        role: String(rule?.role || "").trim(),
        permissions: normalizePermissionList(rule?.permissions),
      }))
      .filter((rule) => rule.role)
    : [];

  const rulesByRole = new Map(providedRules.map((rule) => [rule.role, rule.permissions]));
  const normalizedDefaults = buildDefaultAccessRules().map((rule) => {
    if (ADMIN_ROLES.has(rule.role)) {
      return { role: rule.role, permissions: [...APP_PERMISSION_IDS] };
    }

    if (rule.role === "Clientes") {
      return { role: rule.role, permissions: ["manage_b2b"] };
    }

    return {
      role: rule.role,
      permissions: normalizePermissionList(rulesByRole.get(rule.role) || rule.permissions),
    };
  });

  const extraRules = providedRules
    .filter((rule) => !normalizedDefaults.some((item) => item.role === rule.role))
    .map((rule) => ({
      role: rule.role,
      permissions: normalizePermissionList(rule.permissions),
    }));

  return [...normalizedDefaults, ...extraRules];
}

async function requireData<T>(promise: PromiseLike<{ data: T | null; error: any }>, fallback = "Falha ao acessar o Supabase.") {
  const { data, error } = await promise;
  if (error) {
    const status = error.code === "23505" ? 409 : 500;
    fail(error.message || fallback, status);
  }
  return data as T;
}

async function getAccessRules() {
  const rows = await requireData<any[]>(
    db.from("app_settings").select("value").eq("key", "access_rules").limit(1),
  );
  return normalizeAccessRules(rows?.[0]?.value || buildDefaultAccessRules());
}

function getPermissionsForRole(role: unknown, accessRules: any[]) {
  const normalizedRole = String(role || "").trim();
  if (!normalizedRole) {
    return [];
  }

  if (ADMIN_ROLES.has(normalizedRole)) {
    return [...APP_PERMISSION_IDS];
  }

  if (normalizedRole === "Clientes") {
    return ["manage_b2b"];
  }

  const matchingRule = accessRules.find((rule) => String(rule?.role || "").trim() === normalizedRole);
  return normalizePermissionList(matchingRule?.permissions || []);
}

function getAllowedBaseIdsForMember(member: any) {
  if (!member) {
    return [];
  }

  const rawIds = Array.isArray(member.allowed_base_ids)
    ? member.allowed_base_ids
    : Array.isArray(member.allowedBaseIds)
      ? member.allowedBaseIds
      : [];
  const normalized = normalizeAllowedBaseIds(rawIds);

  if (String(member.role || "").trim() === "Clientes") {
    return normalized.length ? normalized : ALL_BASE_IDS;
  }

  return normalized;
}

function getUserPermissions(user: any) {
  if (!user) {
    return [];
  }

  return Array.isArray(user.permissions) && user.permissions.length > 0
    ? normalizePermissionList(user.permissions)
    : [];
}

function userHasPermission(user: any, permission: string) {
  return getUserPermissions(user).includes(permission);
}

function assertUserHasPermission(user: any, permission: string, message = "Voce nao tem permissao para executar esta acao.") {
  if (!userHasPermission(user, permission)) {
    fail(message, 403);
  }
}

function isClientRole(user: any) {
  return String(user?.role || "").trim() === "Clientes";
}

function assertUserCanCreateScheduling(user: any) {
  if (isClientRole(user)) {
    assertUserHasPermission(user, "manage_b2b", "Clientes podem acessar somente o agendamento das bases liberadas.");
    return;
  }

  assertUserHasPermission(user, "manage_scheduling", "Voce nao tem permissao para criar ou editar agendamentos.");
}

function getClientCustomerLabel(user: any) {
  return String(user?.name || user?.email || "Cliente").trim() || "Cliente";
}

function normalizeClientCustomerKey(value: unknown) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function rowBelongsToClientUser(user: any, row: any) {
  if (!isClientRole(user)) {
    return true;
  }

  return normalizeClientCustomerKey(row?.customer) === normalizeClientCustomerKey(getClientCustomerLabel(user));
}

function getBaseFilterForUser(user: any) {
  if (!user) {
    return null;
  }

  if (user.role === "Clientes") {
    return getAllowedBaseIdsForMember(user);
  }

  const allowedBaseIds = getAllowedBaseIdsForMember(user);
  return allowedBaseIds.length > 0 ? allowedBaseIds : null;
}

function rowIsVisibleToUser(user: any, row: any, baseFilter: string[] | null = null) {
  const baseAllowed = !baseFilter || baseFilter.includes(row?.base_id);
  return baseAllowed && rowBelongsToClientUser(user, row);
}

function assertUserCanAccessBase(user: any, baseId: unknown) {
  if (!user) {
    return;
  }

  const allowedBaseIds = getAllowedBaseIdsForMember(user);
  if (user.role !== "Clientes" && allowedBaseIds.length === 0) {
    return;
  }

  if (!baseId || !allowedBaseIds.includes(String(baseId))) {
    fail("Voce nao tem acesso a esta base.", 403);
  }
}

function assertUserCanAccessRecordRow(user: any, row: any, message = "Voce nao tem acesso a este registro.") {
  assertUserCanAccessBase(user, row?.base_id || null);

  if (!rowBelongsToClientUser(user, row)) {
    fail(message, 403);
  }
}

function toCamelProduct(row: any) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    quantity: row.quantity,
    minQuantity: row.min_quantity,
    unit: row.unit,
    price: Number(row.price),
    lastRestock: normalizeDateKey(row.last_restock),
    status: row.status,
    image: row.image,
    manualEntries: Array.isArray(row.manual_entries) ? row.manual_entries : [],
    manualOutputs: Array.isArray(row.manual_outputs) ? row.manual_outputs : [],
  };
}

function toCamelService(row: any, options: { includePhotos?: boolean } = {}) {
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
    scheduledDate: normalizeDateKey(row.scheduled_date),
    scheduledTime: normalizeTime(row.scheduled_time),
    status: row.status,
    price: Number(row.price),
    priority: row.priority,
    customer: row.customer,
    thirdPartyName: row.third_party_name,
    thirdPartyCpf: row.third_party_cpf,
    observations: row.observations,
    washer: row.washer,
    washers: Array.isArray(row.washers) ? row.washers : [],
    timeline: row.timeline || {},
    preInspectionPhotos: includePhotos ? (row.pre_inspection_photos || {}) : {},
    postInspectionPhotos: includePhotos ? (row.post_inspection_photos || {}) : {},
    startTime: row.start_time,
    endTime: row.end_time,
    image: row.image,
  };
}

function toCamelVehicle(row: any) {
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

function toCamelTeam(row: any, accessRules: any[]) {
  return {
    id: row.id,
    name: row.name,
    registration: row.registration,
    email: row.email || "",
    role: row.role,
    permissions: getPermissionsForRole(row.role, accessRules),
    allowedBaseIds: getAllowedBaseIdsForMember(row),
    rating: Number(row.rating),
    servicesCount: row.services_count,
    status: row.status,
    avatar: row.avatar,
    efficiency: row.efficiency,
  };
}

function toCamelAppointment(row: any) {
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
    date: normalizeDateKey(row.date),
    time: normalizeTime(row.time),
    status: row.status,
    photo: row.photo,
    thirdPartyName: row.third_party_name,
    thirdPartyCpf: row.third_party_cpf,
    createdById: row.created_by_id,
    createdByName: row.created_by_name,
  };
}

function serviceToRow(service: any, current: any = null, photos: any = {}) {
  const nextPrePhotos = Object.keys(photos.pre || {}).length
    ? { ...(current?.pre_inspection_photos || {}), ...photos.pre }
    : (current?.pre_inspection_photos || service.preInspectionPhotos || {});
  const nextPostPhotos = Object.keys(photos.post || {}).length
    ? { ...(current?.post_inspection_photos || {}), ...photos.post }
    : (current?.post_inspection_photos || service.postInspectionPhotos || {});

  return {
    id: service.id,
    sort_order: service.sortOrder || 0,
    plate: String(service.plate || "").toUpperCase().trim(),
    model: service.model || "",
    type: service.type || "car",
    base_id: service.baseId || null,
    base_name: service.baseName || null,
    washing_zone_id: service.washingZoneId || null,
    washing_zone_name: service.washingZoneName || null,
    scheduled_date: service.scheduledDate || null,
    scheduled_time: service.scheduledTime || null,
    status: service.status || "pending",
    price: Number(service.price || 0),
    priority: Boolean(service.priority),
    customer: service.customer || "",
    third_party_name: service.thirdPartyName || null,
    third_party_cpf: service.thirdPartyCpf || null,
    observations: service.observations || null,
    washer: service.washer || null,
    washers: Array.isArray(service.washers) ? service.washers : [],
    timeline: service.timeline || {},
    pre_inspection_photos: nextPrePhotos,
    post_inspection_photos: nextPostPhotos,
    start_time: service.startTime || null,
    end_time: service.endTime || null,
    image: photos.image || current?.image || service.image || null,
    updated_at: new Date().toISOString(),
  };
}

function appointmentToRow(appointment: any, normalizedZone: any) {
  return {
    id: appointment.id,
    customer: appointment.customer || "",
    vehicle: appointment.vehicle || "",
    plate: String(appointment.plate || "").toUpperCase().trim(),
    base_id: appointment.baseId || null,
    base_name: appointment.baseName || null,
    washing_zone_id: normalizedZone.washingZoneId,
    washing_zone_name: normalizedZone.washingZoneName,
    vehicle_type: appointment.vehicleType || null,
    service: appointment.service || "",
    date: appointment.date,
    time: appointment.time,
    status: appointment.status || "confirmed",
    photo: appointment.photo || null,
    third_party_name: appointment.thirdPartyName || null,
    third_party_cpf: appointment.thirdPartyCpf || null,
    created_by_id: String(appointment.createdById || appointment.created_by_id || "").trim() || null,
    created_by_name: String(appointment.createdByName || appointment.created_by_name || "").trim() || null,
    updated_at: new Date().toISOString(),
  };
}

function vehicleToRow(vehicle: any) {
  const sourceVehicleType = normalizeSourceVehicleType(vehicle.sourceVehicleType);
  const normalizedType = sourceVehicleType ? mapSourceVehicleTypeToCategory(sourceVehicleType) : vehicle.type;

  return {
    plate: String(vehicle.plate || "").toUpperCase().trim(),
    customer: vehicle.customer || "",
    model: vehicle.model || "",
    type: normalizedType || "car",
    source_vehicle_type: sourceVehicleType || null,
    city: vehicle.city || null,
    state: vehicle.state || null,
    last_service: vehicle.lastService || null,
    third_party_name: vehicle.thirdPartyName || null,
    third_party_cpf: vehicle.thirdPartyCpf || null,
    updated_at: new Date().toISOString(),
  };
}

function productToRow(product: any, image: string | null) {
  return {
    id: product.id,
    name: product.name || "",
    category: product.category || "",
    quantity: Number(product.quantity || 0),
    min_quantity: Number(product.minQuantity || 0),
    unit: product.unit || "",
    price: Number(product.price || 0),
    last_restock: product.lastRestock || null,
    status: product.status || "ok",
    image,
    manual_entries: Array.isArray(product.manualEntries) ? product.manualEntries : [],
    manual_outputs: Array.isArray(product.manualOutputs) ? product.manualOutputs : [],
    updated_at: new Date().toISOString(),
  };
}

function teamMemberToRow(member: any, passwordHash: string, avatar: string | null) {
  const isClient = member.role === "Clientes";
  const normalizedEmail = normalizeEmail(member.email);
  const registration = isClient
    ? String(member.registration || "").trim() || `CLI-${Date.now()}-${randomHex(3)}`
    : String(member.registration || "").trim();
  const allowedBaseIds = isClient || member.role === "Colaboradores"
    ? getAllowedBaseIdsForMember(member)
    : [];

  return {
    id: member.id,
    name: String(member.name || "").trim(),
    registration,
    email: normalizedEmail || null,
    password_hash: passwordHash,
    role: member.role,
    allowed_base_ids: allowedBaseIds,
    rating: Number(member.rating || 5),
    services_count: Number(member.servicesCount || 0),
    status: member.status || "active",
    avatar: avatar || "",
    efficiency: member.efficiency || "100%",
    updated_at: new Date().toISOString(),
  };
}

function normalizeSourceVehicleType(rawType: unknown) {
  return String(rawType || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function mapSourceVehicleTypeToCategory(rawType: unknown) {
  const normalizedType = normalizeSourceVehicleType(rawType);

  if (normalizedType.includes("MOTO")) return "motorcycle";
  if (normalizedType.includes("CAMINHAO")) return "truck";
  if (normalizedType.includes("PICAPE MEDIA") || normalizedType.includes("CAMINHONETE") || normalizedType.includes("4X4")) return "pickup_4x4";
  if (normalizedType.includes("LANCHA") || normalizedType.includes("BARCO")) return "boat";
  return "car";
}

async function selectAll(table: string) {
  return await requireData<any[]>(db.from(table).select("*"));
}

async function selectOneById(table: string, id: string) {
  const rows = await requireData<any[]>(db.from(table).select("*").eq("id", id).limit(1));
  return rows?.[0] || null;
}

async function ensureUploadBucket() {
  if (uploadBucketReady) {
    return;
  }

  const { data, error } = await db.storage.getBucket(UPLOAD_BUCKET);
  if (!data && error) {
    const created = await db.storage.createBucket(UPLOAD_BUCKET, {
      public: true,
      fileSizeLimit: 1024 * 1024 * 12,
      allowedMimeTypes: Object.keys(IMAGE_EXTENSION_BY_MIME),
    });
    if (created.error && created.error.message && !created.error.message.includes("already exists")) {
      console.warn("Falha ao criar bucket de uploads:", created.error.message);
    }
  }

  uploadBucketReady = true;
}

function sanitizeUploadScope(scope = "general") {
  return String(scope || "general")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9/_-]/g, "")
    .replace(/\/{2,}/g, "/")
    .replace(/^\/|\/$/g, "") || "general";
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function persistUploadedImage(value: unknown, scope = "general") {
  if (!value) {
    return null;
  }

  const normalized = String(value).trim();
  if (!normalized) {
    return null;
  }

  if (normalized.startsWith("/uploads/") || /^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  const match = normalized.match(DATA_URL_PATTERN);
  if (!match) {
    return normalized;
  }

  await ensureUploadBucket();

  const mimeType = match[1].toLowerCase();
  const extension = IMAGE_EXTENSION_BY_MIME[mimeType] || "jpg";
  const filePath = `${sanitizeUploadScope(scope)}/${Date.now()}-${randomHex(8)}.${extension}`;
  const bytes = base64ToBytes(match[2]);
  const upload = await db.storage.from(UPLOAD_BUCKET).upload(filePath, bytes, {
    contentType: mimeType,
    upsert: false,
  });

  if (upload.error) {
    console.warn("Falha ao enviar imagem para Storage; salvando data URL no banco.", upload.error.message);
    return normalized;
  }

  const { data } = db.storage.from(UPLOAD_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

async function persistPhotoMap(photos: any, scope: string) {
  if (!photos || typeof photos !== "object") {
    return {};
  }

  const entries = await Promise.all(
    Object.entries(photos).map(async ([key, value]) => [
      key,
      await persistUploadedImage(value, `${scope}/${key}`),
    ]),
  );

  return Object.fromEntries(entries.filter(([, value]) => Boolean(value)));
}

function inferTarumaZoneId(_vehicleType: unknown) {
  return TARUMA_DIQUE_LEVE_ZONE_ID;
}

function normalizeTarumaZone(baseId: unknown, vehicleType: unknown) {
  if (baseId !== TARUMA_BASE_ID) {
    return {
      washingZoneId: null,
      washingZoneName: null,
    };
  }

  const normalizedZoneId = inferTarumaZoneId(vehicleType);
  return {
    washingZoneId: normalizedZoneId,
    washingZoneName: TARUMA_DIQUE_LEVE_ZONE_NAME,
  };
}

function isActiveTarumaAppointment(appointment: any) {
  return TARUMA_ACTIVE_APPOINTMENT_STATUSES.includes(appointment?.status);
}

function isActiveFloresAppointment(appointment: any) {
  return FLORES_ACTIVE_APPOINTMENT_STATUSES.includes(appointment?.status);
}

function timeToMinutes(value: unknown) {
  const normalized = normalizeTime(value);
  const hours = Number.parseInt(normalized.slice(0, 2), 10);
  const minutes = Number.parseInt(normalized.slice(3, 5), 10);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }
  return (hours * 60) + minutes;
}

function isTruckVehicleType(vehicleType: unknown) {
  return String(vehicleType || "") === "truck";
}

function getTarumaSlotUsageByType(appointments: any[], date: string, time: string, options: any = {}) {
  const targetBaseId = options.baseId || TARUMA_BASE_ID;
  const excludedId = options.excludeId || null;
  const targetDate = normalizeDateKey(date);
  const targetTime = normalizeTime(time);
  const filtered = appointments.filter((appointment) => (
    appointment?.id !== excludedId
    && appointment?.baseId === targetBaseId
    && normalizeDateKey(appointment?.date) === targetDate
    && normalizeTime(appointment?.time) === targetTime
    && isActiveTarumaAppointment(appointment)
  ));
  const truck = filtered.filter((appointment) => isTruckVehicleType(appointment?.vehicleType)).length;
  const total = filtered.length;
  return { total, truck, other: total - truck };
}

function canTarumaBookSlot(appointments: any[], date: string, time: string, options: any = {}) {
  const targetBaseId = options.baseId || TARUMA_BASE_ID;
  const excludedId = options.excludeId || null;
  const targetDate = String(normalizeDateKey(date) || "");
  const targetTime = normalizeTime(time);
  const nextIsTruck = isTruckVehicleType(options.nextVehicleType);
  const usage = getTarumaSlotUsageByType(appointments, targetDate, targetTime, { baseId: targetBaseId, excludeId: excludedId });
  const isEndOfShiftSlot = targetTime === TARUMA_END_OF_SHIFT_TIME;
  const hasTruckInSlot = isEndOfShiftSlot ? usage.truck > 0 : (usage.truck > 0 || nextIsTruck);
  const slotTotalLimit = isEndOfShiftSlot
    ? (hasTruckInSlot ? TARUMA_END_OF_SHIFT_TRUCK_SLOT_CAPACITY : TARUMA_END_OF_SHIFT_SLOT_CAPACITY)
    : TARUMA_DEFAULT_SLOT_CAPACITY;
  const limits = {
    total: slotTotalLimit,
    truck: isEndOfShiftSlot ? 0 : TARUMA_MAX_TRUCKS_PER_SLOT,
    other: Math.min(TARUMA_MAX_OTHERS_PER_SLOT, slotTotalLimit),
  };

  if (nextIsTruck) {
    if (isEndOfShiftSlot) return { ok: false, reason: "truck_not_allowed_17", limits, usage };
    if (usage.truck >= limits.truck) return { ok: false, reason: "slot_truck_full", limits, usage };

    const hasTruckIntervalConflict = appointments.some((appointment) => {
      const appointmentMinutes = timeToMinutes(appointment?.time);
      const targetMinutes = timeToMinutes(targetTime);
      if (appointmentMinutes === null || targetMinutes === null) return false;
      const diff = Math.abs(appointmentMinutes - targetMinutes);
      return appointment?.id !== excludedId
        && appointment?.baseId === targetBaseId
        && normalizeDateKey(appointment?.date) === targetDate
        && isActiveTarumaAppointment(appointment)
        && isTruckVehicleType(appointment?.vehicleType)
        && diff > 0
        && diff < TARUMA_TRUCK_MIN_INTERVAL_MINUTES;
    });

    if (hasTruckIntervalConflict) return { ok: false, reason: "truck_interval", limits, usage };
  } else if (usage.other >= limits.other) {
    return { ok: false, reason: "slot_other_full", limits, usage };
  }

  if (usage.total >= limits.total) return { ok: false, reason: "slot_total_full", limits, usage };
  return { ok: true, limits, usage };
}

function getFloresServiceDurationMinutes(vehicleType: unknown) {
  return isTruckVehicleType(vehicleType) ? FLORES_TRUCK_DURATION_MINUTES : FLORES_CAR_DURATION_MINUTES;
}

function getWeekDay(date: string) {
  const weekDay = new Date(`${normalizeDateKey(date)}T12:00:00`).getDay();
  return Number.isFinite(weekDay) ? weekDay : -1;
}

function getFloresWorkWindows(date: string) {
  const weekDay = getWeekDay(date);
  if (weekDay === 2 || weekDay === 4) return FLORES_WEEKDAY_WORK_WINDOWS;
  if (weekDay === 6) return FLORES_SATURDAY_WORK_WINDOWS;
  return [];
}

function minutesToTime(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function getFloresTimeSlots(date: string, vehicleType: unknown) {
  const durationMinutes = getFloresServiceDurationMinutes(vehicleType);
  const slots: string[] = [];
  for (const window of getFloresWorkWindows(date)) {
    const start = timeToMinutes(window.start);
    const end = timeToMinutes(window.end);
    if (start === null || end === null) continue;
    for (let cursor = start; cursor + durationMinutes <= end; cursor += FLORES_SLOT_GRANULARITY_MINUTES) {
      slots.push(minutesToTime(cursor));
    }
  }
  return slots;
}

function getFloresAppointmentInterval(appointment: any) {
  const start = timeToMinutes(appointment?.time);
  if (start === null) return null;
  return {
    start,
    end: start + getFloresServiceDurationMinutes(appointment?.vehicleType),
  };
}

function intervalsOverlap(firstStart: number, firstEnd: number, secondStart: number, secondEnd: number) {
  return firstStart < secondEnd && secondStart < firstEnd;
}

function canFloresBookSlot(appointments: any[], date: string, time: string, options: any = {}) {
  const targetBaseId = options.baseId || FLORES_BASE_ID;
  const excludedId = options.excludeId || null;
  const targetDate = String(normalizeDateKey(date) || "");
  const targetTime = normalizeTime(time);
  const durationMinutes = getFloresServiceDurationMinutes(options.nextVehicleType);
  const start = timeToMinutes(targetTime);

  if (!targetDate || start === null) {
    return { ok: false, reason: "invalid_time", usage: { total: 0 }, durationMinutes };
  }

  const workWindows = getFloresWorkWindows(targetDate);
  if (workWindows.length === 0) {
    return { ok: false, reason: "closed_day", usage: { total: 0 }, durationMinutes };
  }

  const end = start + durationMinutes;
  const fitsWorkWindow = workWindows.some((window) => {
    const windowStart = timeToMinutes(window.start);
    const windowEnd = timeToMinutes(window.end);
    return windowStart !== null && windowEnd !== null && start >= windowStart && end <= windowEnd;
  });

  if (!fitsWorkWindow || !getFloresTimeSlots(targetDate, options.nextVehicleType).includes(targetTime)) {
    return { ok: false, reason: "outside_hours", usage: { total: 0 }, durationMinutes };
  }

  const conflicts = appointments.filter((appointment) => {
    if (
      appointment?.id === excludedId
      || appointment?.baseId !== targetBaseId
      || normalizeDateKey(appointment?.date) !== targetDate
      || !isActiveFloresAppointment(appointment)
    ) {
      return false;
    }
    const appointmentInterval = getFloresAppointmentInterval(appointment);
    return appointmentInterval ? intervalsOverlap(start, end, appointmentInterval.start, appointmentInterval.end) : false;
  });

  if (conflicts.length > 0) return { ok: false, reason: "overlap", usage: { total: conflicts.length }, durationMinutes };
  return { ok: true, usage: { total: 0 }, durationMinutes };
}

async function assertTarumaAppointmentSlotCapacity(appointment: any) {
  if (
    appointment.baseId !== TARUMA_BASE_ID
    || !appointment.date
    || !appointment.time
    || !isActiveTarumaAppointment(appointment)
  ) {
    return;
  }

  const rows = await requireData<any[]>(
    db.from("appointments")
      .select("id,date,time,status,vehicle_type,base_id")
      .eq("base_id", TARUMA_BASE_ID)
      .eq("date", appointment.date)
      .in("status", TARUMA_ACTIVE_APPOINTMENT_STATUSES),
  );
  const existingAppointments = rows
    .filter((row) => row.id !== appointment.id)
    .map((row) => ({
      id: row.id,
      baseId: TARUMA_BASE_ID,
      date: normalizeDateKey(row.date),
      time: normalizeTime(row.time),
      status: row.status,
      vehicleType: row.vehicle_type,
    }));

  const booking = canTarumaBookSlot(existingAppointments, appointment.date, appointment.time, {
    baseId: TARUMA_BASE_ID,
    excludeId: appointment.id,
    nextVehicleType: appointment.vehicleType,
  });

  if (!booking.ok) {
    const lightVehicleLimitLabel = booking.limits.other === 1 ? "1 veiculo leve" : `${booking.limits.other} veiculos leves`;
    const totalVehicleLimitLabel = booking.limits.total === 1 ? "1 veiculo" : `${booking.limits.total} veiculos`;
    const errorMessage = booking.reason === "truck_interval"
      ? "Base Taruma: caminhao exige intervalo minimo de 3 horas entre agendamentos."
      : booking.reason === "truck_not_allowed_17"
        ? "Base Taruma: nao agendamos caminhao no horario das 17:00."
        : booking.reason === "slot_truck_full"
          ? "Horario sem vaga para caminhao na Base Taruma. Limite: 1 caminhao por horario."
          : booking.reason === "slot_other_full"
            ? `Horario sem vaga para veiculo leve na Base Taruma. Limite: ${lightVehicleLimitLabel} por horario.`
            : `Horario sem vaga na Base Taruma. Limite: ${totalVehicleLimitLabel} no Dique Leve.`;
    fail(errorMessage, 409);
  }
}

async function assertFloresAppointmentSchedule(appointment: any) {
  if (
    appointment.baseId !== FLORES_BASE_ID
    || !appointment.date
    || !appointment.time
    || !isActiveFloresAppointment(appointment)
  ) {
    return;
  }

  const rows = await requireData<any[]>(
    db.from("appointments")
      .select("id,date,time,status,vehicle_type,base_id")
      .eq("base_id", FLORES_BASE_ID)
      .eq("date", appointment.date)
      .in("status", FLORES_ACTIVE_APPOINTMENT_STATUSES),
  );
  const existingAppointments = rows
    .filter((row) => row.id !== appointment.id)
    .map((row) => ({
      id: row.id,
      baseId: FLORES_BASE_ID,
      date: normalizeDateKey(row.date),
      time: normalizeTime(row.time),
      status: row.status,
      vehicleType: row.vehicle_type,
    }));

  const booking = canFloresBookSlot(existingAppointments, appointment.date, appointment.time, {
    baseId: FLORES_BASE_ID,
    excludeId: appointment.id,
    nextVehicleType: appointment.vehicleType,
  });

  if (!booking.ok) {
    const errorMessage = booking.reason === "closed_day"
      ? "Base Flores nao atende segunda, quarta, sexta e domingo."
      : booking.reason === "overlap"
        ? "Este intervalo ja esta ocupado na Base Flores."
        : "Horario fora da agenda da Base Flores. Terca e quinta: 08:00-12:00 e 14:00-18:00; sabado: 08:00-12:00.";
    fail(errorMessage, booking.reason === "overlap" ? 409 : 400);
  }
}

async function createAuthSession(memberId: string) {
  const token = randomHex(32);
  const expiresAt = new Date(Date.now() + AUTH_SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await requireData(db.from("auth_sessions").insert({
    token,
    member_id: memberId,
    expires_at: expiresAt,
  }));
  return { token, expiresAt };
}

async function getSessionUser(req: Request) {
  const token = getBearerToken(req);
  if (!token) {
    return null;
  }

  const sessions = await requireData<any[]>(
    db.from("auth_sessions").select("*").eq("token", token).limit(1),
  );
  const session = sessions?.[0] || null;
  if (!session) {
    return null;
  }

  if (new Date(session.expires_at).getTime() <= Date.now()) {
    await db.from("auth_sessions").delete().eq("token", token);
    return null;
  }

  const members = await requireData<any[]>(
    db.from("team_members").select("*").eq("id", session.member_id).limit(1),
  );
  const member = members?.[0] || null;
  if (!member) {
    return null;
  }

  const accessRules = await getAccessRules();
  return toCamelTeam(member, accessRules);
}

async function requireSessionUser(req: Request) {
  const user = await getSessionUser(req);
  if (!user) {
    fail("Sua sessao expirou. Faca login novamente.", 401);
  }
  return user;
}

async function upsertServiceRow(service: any) {
  if (!service.id) {
    fail("Id do servico e obrigatorio.", 400);
  }

  const current = await selectOneById("services", service.id);
  const pre = await persistPhotoMap(service.preInspectionPhotos, "checklists/pre");
  const post = await persistPhotoMap(service.postInspectionPhotos, "checklists/post");
  const image = await persistUploadedImage(service.image || null, "services/preview");
  const row = serviceToRow(service, current, { pre, post, image });
  await requireData(db.from("services").upsert(row, { onConflict: "id" }));
  const updated = await selectOneById("services", service.id);
  return toCamelService(updated);
}

async function upsertVehicleRow(vehicle: any) {
  const row = vehicleToRow(vehicle);
  if (!row.plate) {
    fail("Placa do veiculo e obrigatoria.", 400);
  }
  if (!row.model) {
    fail("Modelo do veiculo e obrigatorio.", 400);
  }
  await requireData(db.from("vehicles").upsert(row, { onConflict: "plate" }));
  const rows = await requireData<any[]>(db.from("vehicles").select("*").eq("plate", row.plate).limit(1));
  return toCamelVehicle(rows[0]);
}

async function upsertProductRow(product: any) {
  if (!product.id) {
    fail("Id do produto e obrigatorio.", 400);
  }
  const current = await selectOneById("products", product.id);
  const image = await persistUploadedImage(product.image || current?.image || null, "products");
  const row = productToRow(product, image);
  await requireData(db.from("products").upsert(row, { onConflict: "id" }));
  const updated = await selectOneById("products", product.id);
  return toCamelProduct(updated);
}

async function upsertTeamMemberRow(member: any) {
  if (!member.id) {
    fail("Id do colaborador e obrigatorio.", 400);
  }

  const normalizedName = String(member.name || "").trim();
  const normalizedEmail = normalizeEmail(member.email);
  const isClient = member.role === "Clientes";
  const registration = isClient
    ? String(member.registration || "").trim() || `CLI-${Date.now()}-${randomHex(3)}`
    : String(member.registration || "").trim();

  if (!normalizedName) fail("Nome do colaborador e obrigatorio.", 400);
  if (!isClient && !registration) fail("Matricula do colaborador e obrigatoria.", 400);
  if (isClient && !normalizedEmail) fail("Email do cliente e obrigatorio.", 400);
  if (normalizedEmail && !isValidEmailAddress(normalizedEmail)) fail("Email invalido.", 400);

  if (member.password) {
    const passwordError = getStrongPasswordError(member.password);
    if (passwordError) fail(passwordError, 400);
  }

  const duplicates = await requireData<any[]>(
    db.from("team_members").select("id").eq("registration", registration).neq("id", member.id).limit(1),
  );
  if (duplicates?.[0]) fail("Ja existe um colaborador com esta matricula.", 409);

  if (normalizedEmail) {
    const team = await selectAll("team_members");
    const duplicateEmail = team.find((row) =>
      row.id !== member.id && normalizeEmail(row.email) === normalizedEmail
    );
    if (duplicateEmail) fail("Ja existe um usuario com este email.", 409);
  }

  const current = await selectOneById("team_members", member.id);
  const existingPasswordHash = current?.password_hash || null;
  if (!existingPasswordHash && !member.passwordHash && !member.password) {
    fail("Informe uma senha forte para criar este usuario.", 400);
  }

  const passwordHash = member.passwordHash
    || (member.password ? await bcrypt.hash(String(member.password), 10) : existingPasswordHash);
  const avatar = await persistUploadedImage(member.avatar || current?.avatar || "", "avatars");
  const row = teamMemberToRow({ ...member, registration }, passwordHash, avatar);
  await requireData(db.from("team_members").upsert(row, { onConflict: "id" }));
  const updated = await selectOneById("team_members", member.id);
  return toCamelTeam(updated, await getAccessRules());
}

async function upsertAppointmentRow(appointment: any) {
  const duplicateRows = await requireData<any[]>(
    db.from("appointments")
      .select("id")
      .ilike("plate", String(appointment.plate || ""))
      .eq("date", appointment.date)
      .eq("time", appointment.time)
      .in("status", ["confirmed", "pending"]),
  );
  const duplicate = duplicateRows.find((row) => row.id !== appointment.id);
  if (duplicate) {
    fail("Ja existe um agendamento para esta placa neste mesmo horario.", 409);
  }

  await assertTarumaAppointmentSlotCapacity(appointment);
  await assertFloresAppointmentSchedule(appointment);

  const photo = await persistUploadedImage(appointment.photo || null, "appointments");
  const normalizedZone = normalizeTarumaZone(appointment.baseId || null, appointment.vehicleType || null);
  const current = await selectOneById("appointments", appointment.id);
  const row = appointmentToRow({ ...appointment, photo }, normalizedZone);
  if (current?.created_by_id && !row.created_by_id) row.created_by_id = current.created_by_id;
  if (current?.created_by_name && !row.created_by_name) row.created_by_name = current.created_by_name;
  await requireData(db.from("appointments").upsert(row, { onConflict: "id" }));
  const updated = await selectOneById("appointments", appointment.id);
  return toCamelAppointment(updated);
}

async function sanitizeVehiclePayloadForUser(user: any, vehicle: any) {
  if (userHasPermission(user, "manage_vehicle_base")) {
    return vehicle;
  }

  if (!isClientRole(user)) {
    fail("Voce nao tem permissao para executar esta acao.", 403);
  }

  const plate = String(vehicle?.plate || "").toUpperCase().trim();
  const customerLabel = getClientCustomerLabel(user);
  const normalizedModel = String(vehicle?.model || "").trim();
  if (!plate) fail("Placa do veiculo e obrigatoria.", 400);
  if (!normalizedModel) fail("Modelo do veiculo e obrigatorio.", 400);

  const existingRows = await requireData<any[]>(db.from("vehicles").select("customer").eq("plate", plate).limit(1));
  const existingCustomer = normalizeClientCustomerKey(existingRows?.[0]?.customer);
  if (existingCustomer && existingCustomer !== normalizeClientCustomerKey(customerLabel)) {
    fail("Este veiculo ja esta cadastrado e nao pode ser alterado por este acesso.", 403);
  }

  return {
    plate,
    customer: customerLabel,
    model: normalizedModel,
    type: vehicle?.type,
    sourceVehicleType: vehicle?.sourceVehicleType,
    city: "",
    state: "",
    lastService: "",
    thirdPartyName: "",
    thirdPartyCpf: "",
  };
}

async function getVehicleRowVisibleToUser(user: any, plate: string) {
  const rows = await requireData<any[]>(
    db.from("vehicles").select("*").eq("plate", String(plate || "").toUpperCase().trim()).limit(1),
  );
  const row = rows?.[0] || null;
  if (!row || !rowBelongsToClientUser(user, row)) {
    return null;
  }
  return row;
}

async function sanitizeSchedulingPayloadForUser(user: any, appointment: any, service: any) {
  if (!isClientRole(user)) {
    return { appointment, service };
  }

  const requestedPlate = String(appointment?.plate || service?.plate || "").toUpperCase().trim();
  if (!requestedPlate) fail("Informe a placa do veiculo para agendar.", 400);

  const vehicleRow = await getVehicleRowVisibleToUser(user, requestedPlate);
  if (!vehicleRow) fail("Esta placa nao esta vinculada ao seu cadastro.", 403);

  const customerLabel = getClientCustomerLabel(user);
  const vehicle = toCamelVehicle(vehicleRow);
  return {
    appointment: {
      ...appointment,
      customer: customerLabel,
      vehicle: vehicle.model,
      plate: vehicle.plate,
      vehicleType: vehicle.type,
      createdById: user?.id || appointment?.createdById,
      createdByName: user?.name || appointment?.createdByName,
    },
    service: {
      ...service,
      customer: customerLabel,
      model: vehicle.model,
      plate: vehicle.plate,
      type: vehicle.type,
    },
  };
}

function normalizeClientPlate(value: unknown) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").trim();
}

function normalizeClientSignupPayload(payload: any = {}) {
  const name = String(payload.name || payload.customer || "").trim().replace(/\s+/g, " ");
  const email = normalizeEmail(payload.email);
  const password = String(payload.password || "");
  const confirmPassword = String(payload.confirmPassword || "");
  const baseId = String(payload.baseId || "").trim();
  const rawVehicles = Array.isArray(payload.vehicles) ? payload.vehicles : [];

  if (!name) fail("Informe o nome do cliente.", 400);
  if (!email) fail("Informe o email do cliente.", 400);
  if (!password) fail("Informe uma senha forte para criar o acesso.", 400);
  if (!confirmPassword) fail("Confirme a senha para criar o acesso.", 400);
  if (password !== confirmPassword) fail("A confirmacao da senha nao confere.", 400);
  if (!baseId || !ALL_BASE_IDS.includes(baseId)) fail("Selecione uma base valida para o cliente.", 400);
  if (rawVehicles.length === 0) fail("Cadastre pelo menos um veiculo para liberar o agendamento.", 400);

  const seenPlates = new Set<string>();
  const vehicles = rawVehicles.map((vehicle: any) => {
    const plate = normalizeClientPlate(vehicle?.plate);
    const model = String(vehicle?.model || "").trim().replace(/\s+/g, " ");
    const requestedType = String(vehicle?.type || "car").trim();
    const type = ["car", "motorcycle", "truck", "boat", "pickup_4x4"].includes(requestedType) ? requestedType : "car";
    if (!plate) fail("Placa do veiculo e obrigatoria.", 400);
    if (plate.length < 7) fail("Informe uma placa valida para o veiculo.", 400);
    if (seenPlates.has(plate)) fail("Remova placas duplicadas antes de criar o cadastro.", 400);
    if (!model) fail("Modelo do veiculo e obrigatorio.", 400);
    seenPlates.add(plate);
    const sourceVehicleType = {
      car: "PASSEIO",
      motorcycle: "MOTO",
      truck: "CAMINHAO",
      boat: "LANCHA",
      pickup_4x4: "PICAPE MEDIA",
    }[type] || "PASSEIO";
    return { plate, model, type, sourceVehicleType };
  });

  return { name, email, password, baseId, vehicles };
}

async function syncAppointmentStatuses() {
  const [appointments, services] = await Promise.all([selectAll("appointments"), selectAll("services")]);
  const statusRank: Record<string, number> = {
    pending: 1,
    in_progress: 2,
    waiting_payment: 3,
    completed: 4,
    no_show: 5,
  };

  const updates = appointments.flatMap((appointment: any) => {
    const related = services
      .filter((service: any) => service.id === appointment.id || (
        String(service.plate || "").toUpperCase() === String(appointment.plate || "").toUpperCase()
        && normalizeDateKey(service.scheduled_date) === normalizeDateKey(appointment.date)
        && normalizeTime(service.scheduled_time) === normalizeTime(appointment.time)
        && String(service.base_id || "") === String(appointment.base_id || "")
      ))
      .sort((left: any, right: any) => {
        if (left.id === appointment.id && right.id !== appointment.id) return -1;
        if (right.id === appointment.id && left.id !== appointment.id) return 1;
        return (statusRank[left.status] || 6) - (statusRank[right.status] || 6);
      })[0];

    if (!related) {
      return [];
    }

    const nextStatus = related.status === "pending"
      ? (["confirmed", "pending"].includes(appointment.status) ? appointment.status : "confirmed")
      : ["in_progress", "waiting_payment", "completed", "no_show"].includes(related.status)
        ? related.status
        : appointment.status;

    return nextStatus !== appointment.status
      ? [{ id: appointment.id, status: nextStatus, updated_at: new Date().toISOString() }]
      : [];
  });

  for (const update of updates) {
    await db.from("appointments").update({ status: update.status, updated_at: update.updated_at }).eq("id", update.id);
  }
}

async function cleanupOrphanActiveAppointments() {
  const [appointments, services] = await Promise.all([selectAll("appointments"), selectAll("services")]);
  const activeAppointments = appointments.filter((appointment: any) => ["confirmed", "pending"].includes(appointment.status));
  for (const appointment of activeAppointments) {
    const hasPendingService = services.some((service: any) => service.status === "pending" && (
      service.id === appointment.id || (
        String(service.plate || "").toUpperCase() === String(appointment.plate || "").toUpperCase()
        && normalizeDateKey(service.scheduled_date) === normalizeDateKey(appointment.date)
        && normalizeTime(service.scheduled_time) === normalizeTime(appointment.time)
        && String(service.base_id || "") === String(appointment.base_id || "")
      )
    ));
    if (!hasPendingService) {
      await db.from("appointments").delete().eq("id", appointment.id);
    }
  }
}

function serviceSort(left: any, right: any) {
  const rank: Record<string, number> = {
    pending: 1,
    in_progress: 2,
    waiting_payment: 3,
    completed: 4,
    no_show: 5,
  };
  const leftRank = rank[left.status] || 6;
  const rightRank = rank[right.status] || 6;
  if (leftRank !== rightRank) return leftRank - rightRank;
  if ((left.sort_order || 0) !== (right.sort_order || 0)) return (left.sort_order || 0) - (right.sort_order || 0);
  const rightDate = `${normalizeDateKey(right.scheduled_date) || ""}T${normalizeTime(right.scheduled_time) || "00:00"}`;
  const leftDate = `${normalizeDateKey(left.scheduled_date) || ""}T${normalizeTime(left.scheduled_time) || "00:00"}`;
  if (rightDate !== leftDate) return rightDate.localeCompare(leftDate);
  return String(right.created_at || "").localeCompare(String(left.created_at || ""));
}

function getDateMinusDays(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function getServiceEventDate(service: any) {
  return String(
    service.timeline?.completedAt
      || service.timeline?.noShowAt
      || service.timeline?.paymentCompletedAt
      || service.timeline?.washCompletedAt
      || service.endTime
      || service.startTime
      || `${service.scheduledDate || ""}T${service.scheduledTime || "00:00"}`,
  );
}

function getDurationMinutes(startValue: unknown, endValue: unknown) {
  if (!startValue || !endValue) return null;
  const start = Date.parse(String(startValue));
  const end = Date.parse(String(endValue));
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return Math.round((end - start) / 60000);
}

function buildVehicleHistoryMetrics(record: any) {
  if (!record) {
    return { waitingMinutes: null, washMinutes: null, paymentMinutes: null, totalMinutes: null };
  }
  return {
    waitingMinutes: getDurationMinutes(record.timeline?.checkInAt || record.timeline?.createdAt, record.timeline?.washStartedAt || record.startTime || record.timeline?.noShowAt),
    washMinutes: getDurationMinutes(record.timeline?.washStartedAt || record.startTime, record.timeline?.washCompletedAt || record.endTime),
    paymentMinutes: getDurationMinutes(record.timeline?.paymentStartedAt, record.timeline?.paymentCompletedAt),
    totalMinutes: getDurationMinutes(record.timeline?.checkInAt || record.timeline?.createdAt || record.timeline?.washStartedAt || record.startTime, record.timeline?.completedAt || record.timeline?.noShowAt || record.timeline?.paymentCompletedAt || record.timeline?.washCompletedAt || record.endTime),
  };
}

function buildVehicleHistoryGroups(services: any[], vehicles: any[]) {
  const serviceMap = new Map<string, any[]>();
  services.forEach((service) => {
    const key = String(service.plate || "").toUpperCase();
    serviceMap.set(key, [...(serviceMap.get(key) || []), service]);
  });

  const groups: any[] = [];
  const knownPlates = new Set<string>();
  const pushVehicleGroup = (plate: string, vehicle: any, records: any[]) => {
    const sortedRecords = [...records].sort((left, right) => getServiceEventDate(right).localeCompare(getServiceEventDate(left)));
    const latestRecord = sortedRecords[0];
    const completedRecords = sortedRecords.filter((item) => item.status === "completed");
    const totalRevenue = completedRecords.reduce((total, item) => total + Number(item.price || 0), 0);
    const averageTicket = completedRecords.length ? Number((totalRevenue / completedRecords.length).toFixed(2)) : null;
    const latestMetrics = buildVehicleHistoryMetrics(latestRecord);
    const averageWashSamples = completedRecords
      .map((item) => buildVehicleHistoryMetrics(item).washMinutes)
      .filter((value) => typeof value === "number");
    const averageWashMinutes = averageWashSamples.length
      ? Math.round(averageWashSamples.reduce((total, value) => total + Number(value), 0) / averageWashSamples.length)
      : null;

    groups.push({
      plate,
      customer: latestRecord?.customer || vehicle?.customer || "Nao informado",
      model: latestRecord?.model || vehicle?.model || "Veiculo nao informado",
      type: vehicle?.type || null,
      previewImage: latestRecord?.image || null,
      records: sortedRecords,
      completedCount: completedRecords.length,
      noShowCount: sortedRecords.filter((item) => item.status === "no_show").length,
      activeCount: sortedRecords.filter((item) => ["pending", "in_progress", "waiting_payment"].includes(item.status)).length,
      totalRevenue,
      averageTicket,
      lastRecordedAt: latestRecord ? getServiceEventDate(latestRecord) : null,
      lastBaseName: latestRecord?.baseName || null,
      lastServiceType: latestRecord?.type || null,
      lastStatus: latestRecord?.status || null,
      lastPrice: latestRecord ? Number(latestRecord.price || 0) : null,
      lastWashers: Array.isArray(latestRecord?.washers) ? latestRecord.washers.map((value: unknown) => String(value).trim()).filter(Boolean) : [],
      averageWashMinutes,
      lastWaitingMinutes: latestMetrics.waitingMinutes,
      lastWashMinutes: latestMetrics.washMinutes,
      lastPaymentMinutes: latestMetrics.paymentMinutes,
      lastTotalMinutes: latestMetrics.totalMinutes,
    });
  };

  vehicles.forEach((vehicle) => {
    const plate = String(vehicle.plate || "").toUpperCase();
    knownPlates.add(plate);
    pushVehicleGroup(plate, vehicle, serviceMap.get(plate) || []);
  });

  serviceMap.forEach((records, plate) => {
    if (!knownPlates.has(plate)) pushVehicleGroup(plate, null, records);
  });

  return groups.sort((left, right) => {
    const rightDate = right.lastRecordedAt || "";
    const leftDate = left.lastRecordedAt || "";
    if (rightDate !== leftDate) return rightDate.localeCompare(leftDate);
    return left.plate.localeCompare(right.plate);
  });
}

function getDateRangeFromSearch(url: URL) {
  const startDate = normalizeDateKey(url.searchParams.get("startDate"));
  const endDate = normalizeDateKey(url.searchParams.get("endDate"));
  if (!startDate || !endDate) return null;
  return startDate <= endDate ? { startDate, endDate } : { startDate: endDate, endDate: startDate };
}

function serviceIsWithinDateRange(service: any, dateRange: any) {
  if (!dateRange) return true;
  const eventDate = normalizeDateKey(getServiceEventDate(service));
  return Boolean(eventDate && eventDate >= dateRange.startDate && eventDate <= dateRange.endDate);
}

function generateTemporaryPassword(length = 16) {
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const symbols = "!@#$%&*?";
  const all = `${lower}${upper}${digits}${symbols}`;
  const chars = [
    lower[randomIndex(lower.length)],
    upper[randomIndex(upper.length)],
    digits[randomIndex(digits.length)],
    symbols[randomIndex(symbols.length)],
  ];
  while (chars.length < Math.max(12, Math.min(32, length))) {
    chars.push(all[randomIndex(all.length)]);
  }
  for (let index = chars.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(index + 1);
    [chars[index], chars[swapIndex]] = [chars[swapIndex], chars[index]];
  }
  return chars.join("");
}

async function updateMemberTemporaryPassword(member: any, temporaryPassword: string) {
  const passwordHash = await bcrypt.hash(temporaryPassword, 10);
  await requireData(db.from("team_members").update({
    password_hash: passwordHash,
    updated_at: new Date().toISOString(),
  }).eq("id", member.id));
  await db.from("auth_sessions").delete().eq("member_id", member.id);
}

async function handleLogin(req: Request, body: any) {
  const identifier = String(body?.identifier || body?.registration || "").trim();
  const password = String(body?.password || "");
  if (!identifier || !password) {
    fail("Matricula ou email e senha sao obrigatorios.", 400);
  }

  const team = await selectAll("team_members");
  const member = team.find((row: any) =>
    String(row.registration || "") === identifier
    || normalizeEmail(row.email) === normalizeEmail(identifier)
  );
  if (!member) fail("Credenciais invalidas.", 401);

  const isValid = await bcrypt.compare(password, member.password_hash);
  if (!isValid) fail("Credenciais invalidas.", 401);

  const session = await createAuthSession(member.id);
  const accessRules = await getAccessRules();
  return jsonResponse(req, { user: toCamelTeam(member, accessRules), token: session.token, expiresAt: session.expiresAt });
}

async function handleRegisterClient(req: Request, body: any) {
  const signup = normalizeClientSignupPayload(body || {});
  if (!isValidEmailAddress(signup.email)) fail("Email invalido.", 400);
  const passwordError = getStrongPasswordError(signup.password);
  if (passwordError) fail(passwordError, 400);

  for (const vehicle of signup.vehicles) {
    const existing = await requireData<any[]>(db.from("vehicles").select("plate").eq("plate", vehicle.plate).limit(1));
    if (existing?.[0]) {
      fail(`O veiculo ${vehicle.plate} ja esta cadastrado. Entre com o acesso existente ou fale com a equipe.`, 409);
    }
  }

  const memberPayload = {
    id: `client-${Date.now()}-${randomHex(4)}`,
    name: signup.name,
    registration: `CLI-${Date.now()}-${randomHex(3)}`,
    email: signup.email,
    password: signup.password,
    role: "Clientes",
    allowedBaseIds: [signup.baseId],
    rating: 5,
    servicesCount: 0,
    status: "active",
    avatar: "",
    efficiency: "100%",
  };

  const member = await upsertTeamMemberRow(memberPayload);
  const vehicles = [];
  for (const vehicle of signup.vehicles) {
    vehicles.push(await upsertVehicleRow({
      plate: vehicle.plate,
      customer: signup.name,
      model: vehicle.model,
      type: vehicle.type,
      sourceVehicleType: vehicle.sourceVehicleType,
      city: "",
      state: "",
      lastService: "",
      thirdPartyName: "",
      thirdPartyCpf: "",
    }));
  }

  const session = await createAuthSession(member.id);
  return jsonResponse(req, { user: member, token: session.token, expiresAt: session.expiresAt, vehicles }, 201);
}

async function handleBootstrap(req: Request, user: any) {
  await syncAppointmentStatuses();
  await cleanupOrphanActiveAppointments();

  const accessRules = await getAccessRules();
  const baseFilter = getBaseFilterForUser(user);
  const [settingsRows, serviceRows, appointmentRows, productRows, teamRows] = await Promise.all([
    requireData<any[]>(db.from("app_settings").select("value").eq("key", "service_types").limit(1)),
    selectAll("services"),
    selectAll("appointments"),
    selectAll("products"),
    selectAll("team_members"),
  ]);
  const cutoffDate = getDateMinusDays(62);
  const services = serviceRows
    .filter((row) => OPERATIONAL_SERVICE_STATUSES.includes(row.status) || (normalizeDateKey(row.scheduled_date || row.start_time || row.end_time || row.created_at) || "") >= cutoffDate)
    .filter((row) => rowIsVisibleToUser(user, row, baseFilter))
    .sort(serviceSort)
    .map((row) => toCamelService(row, { includePhotos: false }));
  const appointments = appointmentRows
    .filter((row) => rowIsVisibleToUser(user, row, baseFilter))
    .sort((left, right) => `${right.date}T${right.time}`.localeCompare(`${left.date}T${left.time}`))
    .map(toCamelAppointment);

  return jsonResponse(req, {
    currentUser: user,
    serviceTypes: settingsRows?.[0]?.value || {},
    accessRules,
    services,
    appointments,
    products: userHasPermission(user, "manage_inventory") ? productRows.map(toCamelProduct).sort((a, b) => a.name.localeCompare(b.name)) : [],
    team: userHasPermission(user, "manage_team") ? teamRows.map((row) => toCamelTeam(row, accessRules)).sort((a, b) => a.name.localeCompare(b.name)) : [],
  });
}

async function handleVehicleHistory(req: Request, user: any, url: URL, plate?: string) {
  assertUserHasPermission(user, "view_analytics", "Voce nao tem permissao para visualizar o historico de veiculos.");
  const baseFilter = getBaseFilterForUser(user);
  const dateRange = getDateRangeFromSearch(url);
  const [vehicleRows, serviceRows] = await Promise.all([selectAll("vehicles"), selectAll("services")]);
  const services = serviceRows
    .filter((row) => ["completed", "no_show", "pending", "in_progress", "waiting_payment"].includes(row.status))
    .filter((row) => rowIsVisibleToUser(user, row, baseFilter))
    .map((row) => toCamelService(row, { includePhotos: false }))
    .filter((service) => serviceIsWithinDateRange(service, dateRange));
  const vehicles = vehicleRows
    .filter((row) => rowBelongsToClientUser(user, row))
    .map(toCamelVehicle);
  const groups = buildVehicleHistoryGroups(services, vehicles);

  if (!plate) {
    return jsonResponse(req, groups.map((group) => ({
      ...group,
      recordCount: group.records.length,
      records: undefined,
    })));
  }

  const normalizedPlate = String(plate || "").toUpperCase();
  const detail = groups.find((group) => group.plate === normalizedPlate);
  if (!detail) fail("Historico do veiculo nao encontrado.", 404);
  return jsonResponse(req, {
    ...detail,
    recordCount: detail.records.length,
  });
}

async function saveInspectionPhoto(serviceId: string, stage: string, photoId: string, imageData: string) {
  const row = await selectOneById("services", serviceId);
  if (!row) fail("Servico nao encontrado.", 404);
  const currentService = toCamelService(row);
  const persisted = await persistUploadedImage(imageData, `checklists/${stage}/${photoId}`);
  const currentPhotos = stage === "pre"
    ? (currentService.preInspectionPhotos || {})
    : (currentService.postInspectionPhotos || {});
  const nextPhotos = { ...currentPhotos, [photoId]: persisted };
  const nowIso = new Date().toISOString();
  const nextService = {
    ...currentService,
    preInspectionPhotos: stage === "pre" ? nextPhotos : currentService.preInspectionPhotos,
    postInspectionPhotos: stage === "post" ? nextPhotos : currentService.postInspectionPhotos,
    image: nextPhotos.front || currentService.image || "",
    timeline: {
      ...(currentService.timeline || {}),
      ...(stage === "pre" ? { preInspectionStartedAt: currentService.timeline?.preInspectionStartedAt || nowIso } : {}),
    },
  };
  return await upsertServiceRow(nextService);
}

async function transitionServiceStage(serviceId: string, action: "start_wash" | "complete_wash", payload: any = {}) {
  const row = await selectOneById("services", serviceId);
  if (!row) fail("Servico nao encontrado.", 404);
  const currentService = toCamelService(row);
  const nowIso = new Date().toISOString();
  let nextService = currentService;

  if (action === "start_wash") {
    const nextPrePhotos = {
      ...(currentService.preInspectionPhotos || {}),
      ...((payload.preInspectionPhotos && typeof payload.preInspectionPhotos === "object") ? payload.preInspectionPhotos : {}),
    };
    const nextWashers = Array.isArray(payload.washers)
      ? payload.washers.map((value: unknown) => String(value).trim()).filter(Boolean)
      : (currentService.washers || []);
    nextService = {
      ...currentService,
      washers: nextWashers,
      observations: String(payload.observations || "").trim() || currentService.observations || "",
      preInspectionPhotos: nextPrePhotos,
      image: nextPrePhotos.front || currentService.image || "",
      status: currentService.status === "pending" ? "in_progress" : currentService.status,
      startTime: currentService.startTime || nowIso,
      timeline: {
        ...(currentService.timeline || {}),
        preInspectionStartedAt: currentService.timeline?.preInspectionStartedAt || nowIso,
        preInspectionCompletedAt: currentService.timeline?.preInspectionCompletedAt || nowIso,
        washStartedAt: currentService.timeline?.washStartedAt || currentService.startTime || nowIso,
      },
    };
  }

  if (action === "complete_wash") {
    const nextPostPhotos = {
      ...(currentService.postInspectionPhotos || {}),
      ...((payload.postInspectionPhotos && typeof payload.postInspectionPhotos === "object") ? payload.postInspectionPhotos : {}),
    };
    nextService = {
      ...currentService,
      postInspectionPhotos: nextPostPhotos,
      image: nextPostPhotos.front || currentService.image || "",
      status: ["completed", "no_show"].includes(currentService.status) ? currentService.status : "waiting_payment",
      endTime: currentService.endTime || nowIso,
      timeline: {
        ...(currentService.timeline || {}),
        postInspectionStartedAt: currentService.timeline?.postInspectionStartedAt || nowIso,
        washCompletedAt: currentService.timeline?.washCompletedAt || currentService.endTime || nowIso,
        postInspectionCompletedAt: currentService.timeline?.postInspectionCompletedAt || nowIso,
      },
    };
  }

  const updatedService = await upsertServiceRow(nextService);
  let nextAppointment = null;
  const appointmentRow = await selectOneById("appointments", serviceId);
  if (appointmentRow) {
    const currentAppointment = toCamelAppointment(appointmentRow);
    const nextAppointmentStatus = action === "start_wash"
      ? (["in_progress", "waiting_payment", "completed", "no_show"].includes(currentAppointment.status) ? currentAppointment.status : "in_progress")
      : (["waiting_payment", "completed", "no_show"].includes(currentAppointment.status) ? currentAppointment.status : "waiting_payment");
    nextAppointment = await upsertAppointmentRow({ ...currentAppointment, status: nextAppointmentStatus });
  }
  return { service: updatedService, appointment: nextAppointment };
}

async function handleCompletePayment(serviceId: string) {
  const row = await selectOneById("services", serviceId);
  if (!row) fail("Servico nao encontrado.", 404);
  const currentService = toCamelService(row);
  const nowIso = new Date().toISOString();
  const service = await upsertServiceRow({
    ...currentService,
    status: "completed",
    timeline: {
      ...(currentService.timeline || {}),
      paymentStartedAt: currentService.timeline?.paymentStartedAt || nowIso,
      paymentCompletedAt: nowIso,
      completedAt: nowIso,
    },
  });

  let appointment = null;
  const appointmentRow = await selectOneById("appointments", serviceId);
  if (appointmentRow) {
    appointment = await upsertAppointmentRow({ ...toCamelAppointment(appointmentRow), status: "completed" });
  }

  return { service, appointment };
}

async function deleteSchedulingRecord(id: string, user: any) {
  const appointmentRow = await selectOneById("appointments", id);
  const serviceRow = await selectOneById("services", id);
  const referenceBaseId = appointmentRow?.base_id || serviceRow?.base_id || null;
  if (referenceBaseId) assertUserCanAccessBase(user, referenceBaseId);

  const referencePlate = appointmentRow?.plate || serviceRow?.plate || null;
  const referenceDate = appointmentRow?.date || serviceRow?.scheduled_date || null;
  const referenceTime = appointmentRow?.time || serviceRow?.scheduled_time || null;
  const deletedAppointmentIds = new Set<string>();
  const deletedServiceIds = new Set<string>();

  if (appointmentRow) {
    await db.from("appointments").delete().eq("id", appointmentRow.id);
    deletedAppointmentIds.add(appointmentRow.id);
  }
  if (serviceRow) {
    await db.from("services").delete().eq("id", serviceRow.id);
    deletedServiceIds.add(serviceRow.id);
  }

  if (referencePlate && referenceDate && referenceTime) {
    const [appointments, services] = await Promise.all([selectAll("appointments"), selectAll("services")]);
    for (const appointment of appointments) {
      if (
        String(appointment.plate || "").toUpperCase() === String(referencePlate || "").toUpperCase()
        && normalizeDateKey(appointment.date) === normalizeDateKey(referenceDate)
        && normalizeTime(appointment.time) === normalizeTime(referenceTime)
        && ["confirmed", "pending"].includes(appointment.status)
        && (!referenceBaseId || appointment.base_id === referenceBaseId)
      ) {
        await db.from("appointments").delete().eq("id", appointment.id);
        deletedAppointmentIds.add(appointment.id);
      }
    }
    for (const service of services) {
      if (
        String(service.plate || "").toUpperCase() === String(referencePlate || "").toUpperCase()
        && normalizeDateKey(service.scheduled_date) === normalizeDateKey(referenceDate)
        && normalizeTime(service.scheduled_time) === normalizeTime(referenceTime)
        && service.status === "pending"
        && (!referenceBaseId || service.base_id === referenceBaseId)
      ) {
        await db.from("services").delete().eq("id", service.id);
        deletedServiceIds.add(service.id);
      }
    }
  }

  return {
    deletedAppointmentIds: Array.from(deletedAppointmentIds),
    deletedServiceIds: Array.from(deletedServiceIds),
  };
}

async function handleRealWeatherForecast(req: Request, url: URL) {
  const latitude = Number(url.searchParams.get("lat") || -3.119);
  const longitude = Number(url.searchParams.get("lon") || -60.021);
  const days = Math.max(1, Math.min(14, Number(url.searchParams.get("days") || 7)));
  const timezone = url.searchParams.get("tz") || "America/Manaus";

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    fail("Informe lat e lon validos.", 400);
  }

  const forecastUrl = new URL("https://api.open-meteo.com/v1/forecast");
  forecastUrl.searchParams.set("latitude", String(latitude));
  forecastUrl.searchParams.set("longitude", String(longitude));
  forecastUrl.searchParams.set("timezone", timezone);
  forecastUrl.searchParams.set("forecast_days", String(days));
  forecastUrl.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,windspeed_10m_max,weathercode");
  forecastUrl.searchParams.set("current_weather", "true");
  forecastUrl.searchParams.set("hourly", "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation_probability,precipitation,weathercode,windspeed_10m,winddirection_10m");

  const response = await fetch(forecastUrl.toString(), { headers: { accept: "application/json" } });
  if (!response.ok) fail("Falha ao consultar o provedor de clima.", 502);
  const data = await response.json();
  const daily = data?.daily || {};
  const dates = Array.isArray(daily?.time) ? daily.time : [];
  const payload = dates.map((date: string, index: number) => ({
    date,
    minC: Number(daily.temperature_2m_min?.[index]),
    maxC: Number(daily.temperature_2m_max?.[index]),
    rainMm: Number(daily.precipitation_sum?.[index]),
    rainProbability: Number(daily.precipitation_probability_max?.[index]),
    windKph: Number(daily.windspeed_10m_max?.[index]),
    weatherCode: Number(daily.weathercode?.[index]),
  }));
  const hourly = data?.hourly || {};
  const hourlyTimes = Array.isArray(hourly?.time) ? hourly.time : [];
  const referenceTime = typeof data?.current_weather?.time === "string" ? data.current_weather.time : null;
  const hourIndex = referenceTime ? hourlyTimes.indexOf(referenceTime) : -1;
  const startIndex = Math.max(0, hourIndex >= 0 ? hourIndex : 0);
  const endIndex = Math.min(hourlyTimes.length, startIndex + 10);
  const current = hourlyTimes[startIndex]
    ? {
      time: String(hourlyTimes[startIndex]),
      temperatureC: Number(hourly.temperature_2m?.[startIndex]),
      apparentC: Number(hourly.apparent_temperature?.[startIndex]),
      humidity: Number(hourly.relative_humidity_2m?.[startIndex]),
      precipitationProbability: Number(hourly.precipitation_probability?.[startIndex]),
      precipitationMm: Number(hourly.precipitation?.[startIndex]),
      windKph: Number(hourly.windspeed_10m?.[startIndex]),
      windDirectionDeg: Number(hourly.winddirection_10m?.[startIndex]),
      weatherCode: Number(hourly.weathercode?.[startIndex]),
      isDay: typeof data?.current_weather?.is_day === "number" ? Boolean(data.current_weather.is_day) : undefined,
    }
    : null;
  const hours = hourlyTimes.slice(startIndex, endIndex).map((time: string, offset: number) => {
    const index = startIndex + offset;
    return {
      time: String(time),
      temperatureC: Number(hourly.temperature_2m?.[index]),
      precipitationProbability: Number(hourly.precipitation_probability?.[index]),
      precipitationMm: Number(hourly.precipitation?.[index]),
      windKph: Number(hourly.windspeed_10m?.[index]),
      weatherCode: Number(hourly.weathercode?.[index]),
    };
  });

  return jsonResponse(req, {
    source: "open-meteo",
    latitude,
    longitude,
    timezone,
    generatedAt: new Date().toISOString(),
    current,
    hours,
    days: payload,
  });
}

async function handleRequest(req: Request) {
  const url = new URL(req.url);
  const path = normalizeFunctionPath(url);
  const route = path.replace(/^\/api/, "") || "/";
  const parts = route.split("/").filter(Boolean);
  const body = await readJson(req);

  if (req.method === "OPTIONS") return emptyResponse(req);
  if (path === "/api/health" && req.method === "GET") return jsonResponse(req, { ok: true, backend: "supabase-edge" });
  if (path === "/api/auth/login" && req.method === "POST") return await handleLogin(req, body);
  if (path === "/api/auth/register-client" && req.method === "POST") return await handleRegisterClient(req, body);
  if (path === "/api/auth/forgot-password" && req.method === "POST") {
    return jsonResponse(req, { message: "Se este email estiver cadastrado, solicite uma senha temporaria ao administrador." });
  }
  if (path === "/api/auth/logout" && req.method === "POST") {
    const token = getBearerToken(req);
    if (token) await db.from("auth_sessions").delete().eq("token", token);
    return emptyResponse(req);
  }

  const user = await requireSessionUser(req);

  if (path === "/api/bootstrap" && req.method === "GET") return await handleBootstrap(req, user);
  if (path === "/api/weather/forecast" && req.method === "GET") return await handleRealWeatherForecast(req, url);
  if (path === "/api/assistant/tips" && req.method === "POST") {
    return jsonResponse(req, { text: "Sistema conectado ao Supabase. Priorize a fila por horario, base e status operacional." });
  }
  if (path === "/api/assistant/weather" && req.method === "GET") {
    return jsonResponse(req, { text: "Use a previsao real exibida no painel para ajustar equipe e agenda." });
  }
  if (path === "/api/assistant/weather-forecast" && req.method === "GET") {
    return jsonResponse(req, { days: [], generatedAt: new Date().toISOString() });
  }

  if (path === "/api/vehicle-history" && req.method === "GET") return await handleVehicleHistory(req, user, url);
  if (parts[0] === "vehicle-history" && parts[1] && req.method === "GET") return await handleVehicleHistory(req, user, url, decodeURIComponent(parts[1]));

  if (path === "/api/access-rules" && req.method === "PUT") {
    assertUserHasPermission(user, "manage_access");
    const value = normalizeAccessRules(Array.isArray(body) ? body : []);
    await requireData(db.from("app_settings").upsert({ key: "access_rules", value, updated_at: new Date().toISOString() }, { onConflict: "key" }));
    return jsonResponse(req, value);
  }
  if (path === "/api/service-types" && req.method === "PUT") {
    assertUserHasPermission(user, "edit_services");
    await requireData(db.from("app_settings").upsert({ key: "service_types", value: body, updated_at: new Date().toISOString() }, { onConflict: "key" }));
    return jsonResponse(req, body);
  }

  if (path === "/api/vehicles" && req.method === "GET") {
    assertUserHasPermission(user, "manage_vehicle_base");
    const rows = await selectAll("vehicles");
    return jsonResponse(req, rows.map(toCamelVehicle).sort((a, b) => a.plate.localeCompare(b.plate)));
  }
  if (path === "/api/vehicles/lookup" && req.method === "GET") {
    const plate = String(url.searchParams.get("plate") || "").toUpperCase().trim();
    if (!plate) fail("Informe a placa para consulta.", 400);
    const row = await getVehicleRowVisibleToUser(user, plate);
    if (!row) fail("Placa nao encontrada na base cadastrada.", 404);
    return jsonResponse(req, toCamelVehicle(row));
  }
  if (path === "/api/vehicles/upsert" && req.method === "POST") {
    const vehicle = await sanitizeVehiclePayloadForUser(user, body || {});
    return jsonResponse(req, await upsertVehicleRow(vehicle));
  }
  if (path === "/api/vehicles/bulk-upsert" && req.method === "POST") {
    assertUserHasPermission(user, "manage_vehicle_base");
    const vehicles = Array.isArray(body) ? body : Array.isArray(body?.vehicles) ? body.vehicles : null;
    if (!vehicles) fail("Informe uma lista valida de veiculos para importacao.", 400);
    const saved = [];
    for (const vehicle of vehicles) saved.push(await upsertVehicleRow(vehicle));
    return jsonResponse(req, saved.sort((a, b) => a.plate.localeCompare(b.plate)));
  }
  if (parts[0] === "vehicles" && parts[1] && req.method === "DELETE") {
    assertUserHasPermission(user, "manage_vehicle_base");
    await db.from("vehicles").delete().eq("plate", decodeURIComponent(parts[1]).toUpperCase().trim());
    return emptyResponse(req);
  }

  if (path === "/api/services/upsert" && req.method === "POST") {
    assertUserCanCreateScheduling(user);
    assertUserCanAccessBase(user, body?.baseId || null);
    return jsonResponse(req, await upsertServiceRow(body || {}));
  }
  if (path === "/api/services" && req.method === "GET") {
    const baseFilter = getBaseFilterForUser(user);
    const rows = (await selectAll("services")).filter((row) => rowIsVisibleToUser(user, row, baseFilter)).sort(serviceSort);
    return jsonResponse(req, rows.map((row) => toCamelService(row, { includePhotos: false })));
  }
  if (parts[0] === "services" && parts[1] && parts[2] === "inspection-photo" && req.method === "POST") {
    assertUserHasPermission(user, "operate_wash", "Voce nao tem permissao para operar lavagens.");
    const row = await selectOneById("services", decodeURIComponent(parts[1]));
    if (!row) fail("Servico nao encontrado.", 404);
    assertUserCanAccessRecordRow(user, row);
    if (body?.stage !== "pre" && body?.stage !== "post") fail("Etapa da foto invalida.", 400);
    if (!body?.photoId || !body?.imageData) fail("Foto e identificador sao obrigatorios.", 400);
    return jsonResponse(req, await saveInspectionPhoto(decodeURIComponent(parts[1]), body.stage, String(body.photoId), String(body.imageData)));
  }
  if (parts[0] === "services" && parts[1] && parts[2] === "start-wash" && req.method === "POST") {
    assertUserHasPermission(user, "operate_wash", "Voce nao tem permissao para iniciar lavagens.");
    const row = await selectOneById("services", decodeURIComponent(parts[1]));
    if (!row) fail("Servico nao encontrado.", 404);
    assertUserCanAccessRecordRow(user, row);
    return jsonResponse(req, await transitionServiceStage(decodeURIComponent(parts[1]), "start_wash", body || {}));
  }
  if (parts[0] === "services" && parts[1] && parts[2] === "complete-wash" && req.method === "POST") {
    assertUserHasPermission(user, "operate_wash", "Voce nao tem permissao para concluir lavagens.");
    const row = await selectOneById("services", decodeURIComponent(parts[1]));
    if (!row) fail("Servico nao encontrado.", 404);
    assertUserCanAccessRecordRow(user, row);
    return jsonResponse(req, await transitionServiceStage(decodeURIComponent(parts[1]), "complete_wash", body || {}));
  }
  if (parts[0] === "services" && parts[1] && parts[2] === "complete-payment" && req.method === "POST") {
    assertUserHasPermission(user, "manage_payments", "Voce nao tem permissao para fechar pagamentos.");
    const row = await selectOneById("services", decodeURIComponent(parts[1]));
    if (!row) fail("Servico nao encontrado.", 404);
    assertUserCanAccessRecordRow(user, row);
    return jsonResponse(req, await handleCompletePayment(decodeURIComponent(parts[1])));
  }
  if (parts[0] === "services" && parts[1] && req.method === "GET") {
    const row = await selectOneById("services", decodeURIComponent(parts[1]));
    if (!row) fail("Servico nao encontrado.", 404);
    assertUserCanAccessRecordRow(user, row);
    return jsonResponse(req, toCamelService(row));
  }
  if (parts[0] === "services" && parts[1] && req.method === "DELETE") {
    assertUserHasPermission(user, "delete_services");
    const row = await selectOneById("services", decodeURIComponent(parts[1]));
    if (row) assertUserCanAccessBase(user, row.base_id);
    await db.from("services").delete().eq("id", decodeURIComponent(parts[1]));
    return emptyResponse(req);
  }

  if (path === "/api/scheduling/book" && req.method === "POST") {
    assertUserCanCreateScheduling(user);
    const { appointment, service } = body || {};
    if (!appointment?.id || !service?.id) fail("Agendamento e servico sao obrigatorios.", 400);
    assertUserCanAccessBase(user, appointment.baseId || service.baseId || null);
    const sanitized = await sanitizeSchedulingPayloadForUser(user, appointment, service);
    const appointmentWithCreator = {
      ...sanitized.appointment,
      createdById: sanitized.appointment.createdById || user.id,
      createdByName: sanitized.appointment.createdByName || user.name,
    };
    const savedAppointment = await upsertAppointmentRow(appointmentWithCreator);
    const savedService = await upsertServiceRow(sanitized.service);
    return jsonResponse(req, { appointment: savedAppointment, service: savedService });
  }
  if (parts[0] === "scheduling" && parts[1] && req.method === "DELETE") {
    assertUserHasPermission(user, "delete_services");
    return jsonResponse(req, await deleteSchedulingRecord(decodeURIComponent(parts[1]), user));
  }

  if (path === "/api/appointments" && req.method === "GET") {
    await syncAppointmentStatuses();
    await cleanupOrphanActiveAppointments();
    const baseFilter = getBaseFilterForUser(user);
    const rows = (await selectAll("appointments")).filter((row) => rowIsVisibleToUser(user, row, baseFilter));
    return jsonResponse(req, rows.map(toCamelAppointment));
  }
  if (path === "/api/appointments/upsert" && req.method === "POST") {
    assertUserCanCreateScheduling(user);
    assertUserCanAccessBase(user, body?.baseId || null);
    return jsonResponse(req, await upsertAppointmentRow({
      ...(body || {}),
      createdById: body?.createdById || user.id,
      createdByName: body?.createdByName || user.name,
    }));
  }
  if (parts[0] === "appointments" && parts[1] && req.method === "DELETE") {
    assertUserHasPermission(user, "delete_services");
    const row = await selectOneById("appointments", decodeURIComponent(parts[1]));
    if (row) assertUserCanAccessBase(user, row.base_id);
    await db.from("appointments").delete().eq("id", decodeURIComponent(parts[1]));
    return emptyResponse(req);
  }

  if (path === "/api/products" && req.method === "GET") {
    assertUserHasPermission(user, "manage_inventory");
    const rows = await selectAll("products");
    return jsonResponse(req, rows.map(toCamelProduct).sort((a, b) => a.name.localeCompare(b.name)));
  }
  if (path === "/api/products/upsert" && req.method === "POST") {
    assertUserHasPermission(user, "manage_inventory");
    return jsonResponse(req, await upsertProductRow(body || {}));
  }
  if (parts[0] === "products" && parts[1] && req.method === "DELETE") {
    assertUserHasPermission(user, "manage_inventory");
    await db.from("products").delete().eq("id", decodeURIComponent(parts[1]));
    return emptyResponse(req);
  }

  if (path === "/api/team-members" && req.method === "GET") {
    assertUserHasPermission(user, "manage_team");
    const accessRules = await getAccessRules();
    const rows = await selectAll("team_members");
    return jsonResponse(req, rows.map((row) => toCamelTeam(row, accessRules)).sort((a, b) => a.name.localeCompare(b.name)));
  }
  if (path === "/api/team-members/upsert" && req.method === "POST") {
    assertUserHasPermission(user, "manage_team");
    return jsonResponse(req, await upsertTeamMemberRow(body || {}));
  }
  if (parts[0] === "team-members" && parts[1] && parts[2] === "reset-password" && req.method === "POST") {
    assertUserHasPermission(user, "manage_team");
    const member = await selectOneById("team_members", decodeURIComponent(parts[1]));
    if (!member) fail("Usuario nao encontrado.", 404);
    const temporaryPassword = generateTemporaryPassword();
    await updateMemberTemporaryPassword(member, temporaryPassword);
    return jsonResponse(req, {
      temporaryPassword,
      emailSent: false,
      emailStatus: "not_configured",
      emailConfigured: false,
    });
  }
  if (parts[0] === "team-members" && parts[1] && req.method === "DELETE") {
    assertUserHasPermission(user, "manage_team");
    await db.from("team_members").delete().eq("id", decodeURIComponent(parts[1]));
    return emptyResponse(req);
  }

  fail("Rota nao encontrada.", 404);
}

Deno.serve(async (req: Request) => {
  try {
    return await handleRequest(req);
  } catch (error) {
    console.error(error);
    const statusCode = error instanceof ApiError ? error.statusCode : 500;
    const message = error instanceof Error ? error.message : "Erro interno no servidor.";
    return jsonResponse(req, { error: message || "Erro interno no servidor." }, statusCode);
  }
});
