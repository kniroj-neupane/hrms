import postgres from 'postgres';
import { hashPassword } from 'better-auth/crypto';
import { randomUUID } from 'node:crypto';

const sql = postgres(process.env.DATABASE_URL ?? 'postgresql://postgres:password123@localhost:5432/humantryx');

const email = 'hr@humantryx.com';
const password = 'Hr123!';
const name = 'HR Manager';

try {
  const existingUser = await sql`SELECT id FROM users WHERE email = ${email}`;

  let finalUserId = existingUser[0]?.id;

  if (!finalUserId) {
    const insertUser = await sql`
      INSERT INTO users (id, name, email, email_verified, image, created_at, updated_at, role, banned, ban_reason, ban_expires)
      VALUES (${`usr_hr_${Date.now()}`}, ${name}, ${email}, true, NULL, NOW(), NOW(), 'user', false, NULL, NULL)
      RETURNING id
    `;
    finalUserId = insertUser[0].id;
  } else {
    finalUserId = existingUser[0].id;
    await sql`UPDATE users SET name = ${name}, email_verified = true, updated_at = NOW() WHERE id = ${finalUserId}`;
  }

  const existingAccount = await sql`SELECT id FROM accounts WHERE user_id = ${finalUserId} AND provider_id = 'credential'`;

  if (!existingAccount.length) {
    const passwordHash = await hashPassword(password);
    await sql`
      INSERT INTO accounts (id, account_id, provider_id, user_id, access_token, refresh_token, id_token, access_token_expires_at, refresh_token_expires_at, scope, password, issuer, created_at, updated_at)
      VALUES (${`acct_${finalUserId}`}, ${finalUserId}, 'credential', ${finalUserId}, NULL, NULL, NULL, NULL, NULL, NULL, ${passwordHash}, 'local:credential', NOW(), NOW())
    `;
  }

  let orgId = await sql`SELECT id FROM organizations WHERE slug = 'humantryx-hr' OR name = 'Humantryx HR' LIMIT 1`;
  if (!orgId.length) {
    orgId = await sql`
      INSERT INTO organizations (id, name, slug, logo, created_at, metadata)
      VALUES (${`org_hr_${Date.now()}`}, 'Humantryx HR', 'humantryx-hr', NULL, NOW(), NULL)
      RETURNING id
    `;
  }

  const finalOrgId = orgId[0].id;

  const existingMember = await sql`SELECT id FROM members WHERE user_id = ${finalUserId} AND organization_id = ${finalOrgId}`;
  if (!existingMember.length) {
    await sql`
      INSERT INTO members (id, organization_id, user_id, role, created_at)
      VALUES (${`member_hr_${Date.now()}`}, ${finalOrgId}, ${finalUserId}, 'owner', NOW())
    `;
  }

  const memberRecord = await sql`SELECT id FROM members WHERE user_id = ${finalUserId} AND organization_id = ${finalOrgId} LIMIT 1`;
  const existingEmployee = await sql`SELECT id FROM employees WHERE user_id = ${finalUserId}`;

  if (!existingEmployee.length) {
    await sql`
      INSERT INTO employees (id, user_id, organization_id, member_id, designation, department, status, created_at, updated_at)
      VALUES (${randomUUID()}, ${finalUserId}, ${finalOrgId}, ${memberRecord[0].id}, 'hr', 'human_resources', 'active', NOW(), NOW())
    `;
  }

  const result = await sql`
    SELECT u.id, u.email, u.role, u.email_verified, e.designation, e.organization_id
    FROM users u
    LEFT JOIN employees e ON e.user_id = u.id
    WHERE u.email = ${email}
  `;

  console.log('HR_USER_CREATED');
  console.log(JSON.stringify(result, null, 2));
} finally {
  await sql.end();
}
