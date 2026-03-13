import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { withTransaction } from './db.mjs';
import { mapSourceVehicleTypeToCategory, normalizeSourceVehicleType } from './vehicle-type.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serviceTypes = {
  car: {
    label: 'Carro',
    services: [
      { id: 'simple', label: 'Lavagem Simples', price: 70 },
      { id: 'complete', label: 'Lavagem Completa / Motor', price: 90 },
    ],
  },
  motorcycle: {
    label: 'Moto',
    services: [
      { id: 'simple', label: 'Lavagem Simples', price: 30 },
      { id: 'complete', label: 'Lavagem Completa', price: 50 },
    ],
  },
  truck: {
    label: 'Caminhao',
    services: [
      { id: 'simple', label: 'Lavagem Simples', price: 180 },
      { id: 'complete', label: 'Lavagem Completa', price: 250 },
    ],
  },
  pickup_4x4: {
    label: 'Picape Media',
    services: [
      { id: 'simple', label: 'Lavagem Simples', price: 95 },
      { id: 'complete', label: 'Lavagem Completa', price: 130 },
    ],
  },
  boat: {
    label: 'Lancha',
    services: [{ id: 'simple', label: 'Lavagem', price: 200 }],
  },
};

const defaultProducts = [
  {
    id: 'prod-1',
    name: 'Shampoo Automotivo Neutro',
    category: 'Limpeza Externa',
    quantity: 15,
    min_quantity: 5,
    unit: 'Litros',
    price: 45.9,
    last_restock: '2024-02-28',
    status: 'ok',
    image: 'https://images.unsplash.com/photo-1600456548090-7d1b3f0bbea5?q=80&w=200&auto=format&fit=crop',
    manual_entries: [],
    manual_outputs: [],
  },
  {
    id: 'prod-2',
    name: 'Cera de Carnauba Premium',
    category: 'Acabamento',
    quantity: 2,
    min_quantity: 4,
    unit: 'Unidades',
    price: 89.9,
    last_restock: '2024-01-15',
    status: 'critical',
    image: 'https://images.unsplash.com/photo-1626806819282-2c1dc01a5e0c?q=80&w=200&auto=format&fit=crop',
    manual_entries: [],
    manual_outputs: [],
  },
];

const defaultTeam = [
  {
    id: 'team-admin',
    name: 'Administrador Norte Tech',
    registration: '1001',
    email: null,
    password: 'Admin@123456!',
    role: 'Administrador',
    rating: 5,
    services_count: 0,
    status: 'active',
    avatar: 'https://i.pravatar.cc/150?u=admin',
    efficiency: '100%',
  },
];

function loadVehicles() {
  const filePath = path.join(__dirname, 'vehicle-seed.json');
  if (!fs.existsSync(filePath)) {
    return [];
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8')).map((vehicle) => {
    const sourceVehicleType = normalizeSourceVehicleType(vehicle.sourceVehicleType);

    return {
      ...vehicle,
      sourceVehicleType: sourceVehicleType || null,
      type: sourceVehicleType ? mapSourceVehicleTypeToCategory(sourceVehicleType) : vehicle.type,
    };
  });
}

export async function seedDatabase() {
  const vehicles = loadVehicles();

  await withTransaction(async (client) => {
    await client.query(
      `
      INSERT INTO app_settings (key, value)
      VALUES ('service_types', $1::jsonb)
      ON CONFLICT (key) DO NOTHING
      `,
      [JSON.stringify(serviceTypes)]
    );

    for (const member of defaultTeam) {
      const passwordHash = await bcrypt.hash(member.password, 10);
      await client.query(
        `
        INSERT INTO team_members (
          id, name, registration, email, password_hash, role, allowed_base_ids, rating, services_count, status, avatar, efficiency
        ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12)
        ON CONFLICT (registration) DO NOTHING
        `,
        [
          member.id,
          member.name,
          member.registration,
          member.email,
          passwordHash,
          member.role,
          JSON.stringify(member.allowed_base_ids || []),
          member.rating,
          member.services_count,
          member.status,
          member.avatar,
          member.efficiency,
        ]
      );
    }

    for (const product of defaultProducts) {
      await client.query(
        `
        INSERT INTO products (
          id, name, category, quantity, min_quantity, unit, price, last_restock, status, image, manual_entries, manual_outputs
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb)
        ON CONFLICT (id) DO NOTHING
        `,
        [
          product.id,
          product.name,
          product.category,
          product.quantity,
          product.min_quantity,
          product.unit,
          product.price,
          product.last_restock,
          product.status,
          product.image,
          JSON.stringify(product.manual_entries || []),
          JSON.stringify(product.manual_outputs || []),
        ]
      );
    }

    for (const vehicle of vehicles) {
      await client.query(
        `
        INSERT INTO vehicles (
          plate, customer, model, type, source_vehicle_type, city, state, last_service, third_party_name, third_party_cpf
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        ON CONFLICT (plate) DO UPDATE SET
          customer = EXCLUDED.customer,
          model = EXCLUDED.model,
          type = EXCLUDED.type,
          source_vehicle_type = EXCLUDED.source_vehicle_type,
          city = EXCLUDED.city,
          state = EXCLUDED.state,
          updated_at = NOW()
        `,
        [
          vehicle.plate,
          vehicle.customer,
          vehicle.model,
          vehicle.type,
          vehicle.sourceVehicleType || null,
          vehicle.city || null,
          vehicle.state || null,
          vehicle.lastService || null,
          vehicle.thirdPartyName || null,
          vehicle.thirdPartyCpf || null,
        ]
      );
    }
  });
}
