
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { pool, query } from './db.mjs';
import { generateTemporaryPassword } from './password-reset.mjs';

dotenv.config();

async function main() {
  const registration = process.argv[2] || '24000';

  // Find user by registration
  const result = await query(
    'SELECT * FROM team_members WHERE registration = $1 LIMIT 1',
    [registration]
  );

  const member = result.rows[0];
  if (!member) {
    console.error(`Nenhum usuário encontrado com matrícula ${registration}`);
    process.exit(1);
  }

  console.log('Usuário encontrado:', member.name, member.id, member.email || '');

  const tempPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  await query(
    'UPDATE team_members SET password_hash = $2, updated_at = NOW() WHERE id = $1',
    [member.id, passwordHash]
  );

  // Clear all sessions for this user
  await query('DELETE FROM auth_sessions WHERE member_id = $1', [member.id]);

  console.log('\n✅ Senha resetada com sucesso!');
  console.log('Matrícula:', registration);
  console.log('Senha temporária:', tempPassword);
  console.log('\nImportante: compartilhe essa senha com o usuário, é recomendado que ele altere depois');

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

