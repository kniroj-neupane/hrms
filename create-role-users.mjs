import postgres from 'postgres';
import { hashPassword } from 'better-auth/crypto';
import { randomUUID } from 'node:crypto';

const sql = postgres('postgresql://postgres:password123@localhost:5432/humantryx');

const configs = [
  {
    email: 'founder@humantryx.com',
    password: 'Founder123!',
    name: 'Founder',
    designation: 'founder',
    department: 'founder_office',
    memberRole: 'owner',
  },
  {
    email: 'hr.employee@humantryx.com',
    password: 'HrEmp123!',
    name: 'HR Employee',
    designation: 'hr',
    department: 'human_resources',
    memberRole: 'admin',
  },
];

try {
  for (const config of configs) {
    const existing = await sql`SELECT id FROM users WHERE email = ${config.email}`;
    let userId = existing[0]?.id;

    if (!userId) {
      const result = await sql`
        INSERT INTO users (id, name, email, email_verified, image, created_at, updated_at, role, banned, ban_reason, ban_expires)
        VALUES (${`usr_${config.designation}_${Date.now()}`}, ${config.name}, ${config.email}, true, NULL, NOW(), NOW(), 'user', false, NULL, NULL)
        RETURNING id
      `;
      userId = result[0].id;
    }

    const hashedPassword = await hashPassword(config.password);
    const accountExists = await sql`SELECT id FROM accounts WHERE user_id = ${userId} AND provider_id = 'credential'`;
    if (!accountExists.length) {
      await sql`
        INSERT INTO accounts (id, account_id, provider_id, user_id, access_token, refresh_token, id_token, access_token_expires_at, refresh_token_expires_at, scope, password, issuer, created_at, updated_at)
        VALUES (${`acct_${userId}`}, ${userId}, 'credential', ${userId}, NULL, NULL, NULL, NULL, NULL, NULL, ${hashedPassword}, 'local:credential', NOW(), NOW())
      `;
    }

    let org = await sql`SELECT id FROM organizations WHERE slug = 'humantryx-org' LIMIT 1`;
    let orgId = org[0]?.id;
    if (!orgId) {
      org = await sql`
        INSERT INTO organizations (id, name, slug, logo, created_at, metadata)
        VALUES (${`org_${Date.now()}`}, 'Humantryx', 'humantryx-org', NULL, NOW(), NULL)
        RETURNING id
      `;
      orgId = org[0].id;
    }

    const memberExists = await sql`SELECT id FROM members WHERE user_id = ${userId} AND organization_id = ${orgId}`;
    if (!memberExists.length) {
      await sql`
        INSERT INTO members (id, organization_id, user_id, role, created_at)
        VALUES (${`member_${Date.now()}`}, ${orgId}, ${userId}, ${config.memberRole}, NOW())
      `;
    }

    const employeeExists = await sql`SELECT id FROM employees WHERE user_id = ${userId}`;
    if (!employeeExists.length) {
      const memberRow = await sql`SELECT id FROM members WHERE user_id = ${userId} AND organization_id = ${orgId} LIMIT 1`;
      await sql`
        INSERT INTO employees (id, user_id, organization_id, member_id, designation, department, status, created_at, updated_at)
        VALUES (${randomUUID()}, ${userId}, ${orgId}, ${memberRow[0].id}, ${config.designation}, ${config.department}, 'active', NOW(), NOW())
      `;
    }

    console.log(`OK ${config.email} | ${config.password}`);
  }
} finally {
  await sql.end();
}
