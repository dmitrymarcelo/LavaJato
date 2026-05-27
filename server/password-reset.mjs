import { randomBytes } from 'crypto';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%&*?';
const ALL_PASSWORD_CHARS = `${LOWER}${UPPER}${DIGITS}${SYMBOLS}`;

function randomIndex(max) {
  return randomBytes(1)[0] % max;
}

function pick(chars) {
  return chars[randomIndex(chars.length)];
}

function shuffle(chars) {
  const next = [...chars];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(index + 1);
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next.join('');
}

export function generateTemporaryPassword(length = 16) {
  const safeLength = Math.max(12, Math.min(32, Number(length) || 16));
  const required = [pick(LOWER), pick(UPPER), pick(DIGITS), pick(SYMBOLS)];

  while (required.length < safeLength) {
    required.push(pick(ALL_PASSWORD_CHARS));
  }

  return shuffle(required);
}

export function getPasswordResetEmailConfig(env = process.env) {
  const fromEmail = String(env.PASSWORD_RESET_FROM_EMAIL || '').trim();
  const fromName = String(env.PASSWORD_RESET_FROM_NAME || 'Lava Jato Norte Tech').trim();
  const replyTo = String(env.PASSWORD_RESET_REPLY_TO || '').trim();
  const region = String(env.AWS_SES_REGION || env.AWS_REGION || 'us-east-2').trim();
  const appUrl = String(env.PUBLIC_APP_URL || 'https://3-145-153-19.sslip.io/').trim();

  return {
    configured: Boolean(fromEmail),
    fromEmail,
    fromName,
    replyTo,
    region,
    appUrl,
  };
}

export function buildTemporaryPasswordEmail({ name, temporaryPassword, appUrl }) {
  const greetingName = String(name || 'cliente').trim() || 'cliente';
  const loginUrl = String(appUrl || 'https://3-145-153-19.sslip.io/').trim();
  const subject = 'Sua senha temporaria - Lava Jato Norte Tech';
  const text = [
    `Ola, ${greetingName}.`,
    '',
    'Recebemos uma solicitacao para resetar sua senha no Lava Jato Norte Tech.',
    `Senha temporaria: ${temporaryPassword}`,
    '',
    `Acesse: ${loginUrl}`,
    '',
    'Por seguranca, entre no sistema e solicite uma nova senha ao administrador se nao reconheceu esta solicitacao.',
  ].join('\n');
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
      <h2>Sua senha temporaria</h2>
      <p>Ola, <strong>${escapeHtml(greetingName)}</strong>.</p>
      <p>Recebemos uma solicitacao para resetar sua senha no Lava Jato Norte Tech.</p>
      <p style="font-size:18px"><strong>${escapeHtml(temporaryPassword)}</strong></p>
      <p><a href="${escapeHtml(loginUrl)}">Acessar o sistema</a></p>
      <p style="font-size:12px;color:#64748b">Se voce nao solicitou este reset, avise a equipe.</p>
    </div>
  `;

  return { subject, text, html };
}

export async function sendTemporaryPasswordEmail({ toEmail, name, temporaryPassword }, options = {}) {
  const config = options.config || getPasswordResetEmailConfig();
  const normalizedEmail = String(toEmail || '').trim();

  if (!config.configured) {
    return { sent: false, reason: 'not_configured' };
  }

  if (!normalizedEmail) {
    return { sent: false, reason: 'missing_recipient' };
  }

  const email = buildTemporaryPasswordEmail({
    name,
    temporaryPassword,
    appUrl: config.appUrl,
  });
  const client = options.client || new SESv2Client({ region: config.region });
  const source = config.fromName
    ? `${config.fromName.replace(/[<>\r\n]/g, '').trim()} <${config.fromEmail}>`
    : config.fromEmail;

  const command = new SendEmailCommand({
    FromEmailAddress: source,
    Destination: {
      ToAddresses: [normalizedEmail],
    },
    ReplyToAddresses: config.replyTo ? [config.replyTo] : undefined,
    Content: {
      Simple: {
        Subject: { Data: email.subject, Charset: 'UTF-8' },
        Body: {
          Text: { Data: email.text, Charset: 'UTF-8' },
          Html: { Data: email.html, Charset: 'UTF-8' },
        },
      },
    },
  });

  const response = await client.send(command);
  return {
    sent: true,
    messageId: response.MessageId || null,
  };
}

export function getForgotPasswordResponseMessage() {
  return 'Se este email estiver cadastrado, enviaremos uma senha temporaria em instantes.';
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
