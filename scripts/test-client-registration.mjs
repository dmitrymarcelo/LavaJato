import assert from 'node:assert/strict';
import {
  buildClientMemberFromSignup,
  buildClientVehicleFromSignup,
  normalizeClientSignupPayload,
} from '../server/client-registration.mjs';

const validPayload = {
  name: '  Cliente   Novo  ',
  email: ' CLIENTE@EXEMPLO.COM ',
  password: 'SenhaForte#123',
  confirmPassword: 'SenhaForte#123',
  baseId: 'taruma',
  role: 'Administrador',
  allowedBaseIds: ['flores', 'taruma'],
  vehicles: [
    { plate: 'abc-1d23', model: '  Hilux  SRV ', type: 'pickup_4x4' },
  ],
};

const signup = normalizeClientSignupPayload(
  validPayload,
  { availableBaseIds: ['flores', 'taruma'] }
);

assert.equal(signup.name, 'Cliente Novo');
assert.equal(signup.email, 'cliente@exemplo.com');
assert.equal(signup.baseId, 'taruma');
assert.deepEqual(signup.vehicles, [
  {
    plate: 'ABC1D23',
    model: 'Hilux SRV',
    type: 'pickup_4x4',
    sourceVehicleType: 'PICAPE MEDIA',
  },
]);

const member = buildClientMemberFromSignup(signup, {
  id: 'client-test',
  registration: 'CLI-test',
});

assert.equal(member.role, 'Clientes');
assert.deepEqual(member.allowedBaseIds, ['taruma']);
assert.equal(member.email, 'cliente@exemplo.com');

const vehicle = buildClientVehicleFromSignup(signup.vehicles[0], signup);
assert.equal(vehicle.customer, 'Cliente Novo');
assert.equal(vehicle.plate, 'ABC1D23');

assert.throws(
  () => normalizeClientSignupPayload({ ...validPayload, baseId: 'invalida' }, { availableBaseIds: ['taruma'] }),
  /base valida/
);

assert.throws(
  () => normalizeClientSignupPayload({ ...validPayload, vehicles: [] }, { availableBaseIds: ['taruma'] }),
  /pelo menos um veiculo/
);

assert.throws(
  () => normalizeClientSignupPayload({ ...validPayload, confirmPassword: '' }, { availableBaseIds: ['taruma'] }),
  /Confirme a senha/
);

assert.throws(
  () => normalizeClientSignupPayload({
    ...validPayload,
    vehicles: [
      { plate: 'ABC1D23', model: 'Hilux', type: 'car' },
      { plate: 'abc-1d23', model: 'Hilux', type: 'car' },
    ],
  }, { availableBaseIds: ['taruma'] }),
  /duplicadas/
);

console.log('client registration tests passed');
