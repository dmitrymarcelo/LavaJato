const VALID_CLIENT_VEHICLE_TYPES = new Set(['car', 'motorcycle', 'truck', 'boat', 'pickup_4x4']);

const SOURCE_LABEL_BY_TYPE = {
  car: 'PASSEIO',
  motorcycle: 'MOTO',
  truck: 'CAMINHAO',
  boat: 'LANCHA',
  pickup_4x4: 'PICAPE MEDIA',
};

function fail(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

export function normalizeClientPlate(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .trim();
}

export function normalizeClientSignupPayload(payload = {}, options = {}) {
  const availableBaseIds = Array.isArray(options.availableBaseIds) ? options.availableBaseIds : [];
  const name = String(payload.name || payload.customer || '').trim().replace(/\s+/g, ' ');
  const email = String(payload.email || '').trim().toLowerCase();
  const password = String(payload.password || '');
  const confirmPassword = String(payload.confirmPassword || '');
  const baseId = String(payload.baseId || '').trim();
  const rawVehicles = Array.isArray(payload.vehicles) ? payload.vehicles : [];

  if (!name) {
    fail('Informe o nome do cliente.');
  }

  if (!email) {
    fail('Informe o email do cliente.');
  }

  if (!password) {
    fail('Informe uma senha forte para criar o acesso.');
  }

  if (!confirmPassword) {
    fail('Confirme a senha para criar o acesso.');
  }

  if (password !== confirmPassword) {
    fail('A confirmacao da senha nao confere.');
  }

  if (!baseId || !availableBaseIds.includes(baseId)) {
    fail('Selecione uma base valida para o cliente.');
  }

  if (rawVehicles.length === 0) {
    fail('Cadastre pelo menos um veiculo para liberar o agendamento.');
  }

  const seenPlates = new Set();
  const vehicles = rawVehicles.map((vehicle) => {
    const plate = normalizeClientPlate(vehicle?.plate);
    const model = String(vehicle?.model || '').trim().replace(/\s+/g, ' ');
    const requestedType = String(vehicle?.type || 'car').trim();
    const type = VALID_CLIENT_VEHICLE_TYPES.has(requestedType) ? requestedType : 'car';

    if (!plate) {
      fail('Placa do veiculo e obrigatoria.');
    }

    if (plate.length < 7) {
      fail('Informe uma placa valida para o veiculo.');
    }

    if (seenPlates.has(plate)) {
      fail('Remova placas duplicadas antes de criar o cadastro.');
    }

    if (!model) {
      fail('Modelo do veiculo e obrigatorio.');
    }

    seenPlates.add(plate);

    return {
      plate,
      model,
      type,
      sourceVehicleType: SOURCE_LABEL_BY_TYPE[type] || SOURCE_LABEL_BY_TYPE.car,
    };
  });

  return {
    name,
    email,
    password,
    baseId,
    vehicles,
  };
}

export function buildClientMemberFromSignup(signup, ids) {
  return {
    id: ids.id,
    name: signup.name,
    registration: ids.registration,
    email: signup.email,
    password: signup.password,
    role: 'Clientes',
    allowedBaseIds: [signup.baseId],
    rating: 5,
    servicesCount: 0,
    status: 'active',
    avatar: '',
    efficiency: '100%',
  };
}

export function buildClientVehicleFromSignup(vehicle, signup) {
  return {
    plate: vehicle.plate,
    customer: signup.name,
    model: vehicle.model,
    type: vehicle.type,
    sourceVehicleType: vehicle.sourceVehicleType,
    city: '',
    state: '',
    lastService: '',
    thirdPartyName: '',
    thirdPartyCpf: '',
  };
}
