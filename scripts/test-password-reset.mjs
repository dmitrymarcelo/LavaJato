import assert from 'node:assert/strict';
import {
  buildTemporaryPasswordEmail,
  generateTemporaryPassword,
  getForgotPasswordResponseMessage,
  getPasswordResetEmailConfig,
} from '../server/password-reset.mjs';

for (let index = 0; index < 20; index += 1) {
  const password = generateTemporaryPassword();
  assert.equal(password.length, 16);
  assert.match(password, /[a-z]/);
  assert.match(password, /[A-Z]/);
  assert.match(password, /\d/);
  assert.match(password, /[^A-Za-z0-9]/);
}

const config = getPasswordResetEmailConfig({
  AWS_REGION: 'us-east-2',
  PASSWORD_RESET_FROM_EMAIL: 'no-reply@example.com',
  PASSWORD_RESET_FROM_NAME: 'Lava Jato',
  PUBLIC_APP_URL: 'https://example.com/',
});

assert.equal(config.configured, true);
assert.equal(config.region, 'us-east-2');
assert.equal(config.fromEmail, 'no-reply@example.com');
assert.equal(config.appUrl, 'https://example.com/');

const disabledConfig = getPasswordResetEmailConfig({});
assert.equal(disabledConfig.configured, false);

const email = buildTemporaryPasswordEmail({
  name: '<Cliente>',
  temporaryPassword: 'SenhaTemp#123',
  appUrl: 'https://example.com/',
});

assert.match(email.subject, /senha temporaria/i);
assert.match(email.text, /SenhaTemp#123/);
assert.match(email.html, /&lt;Cliente&gt;/);
assert.match(getForgotPasswordResponseMessage(), /email estiver cadastrado/);

console.log('password reset tests passed');
