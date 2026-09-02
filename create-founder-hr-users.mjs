import postgres from 'postgres';
import { hashPassword } from 'better-auth/crypto';
import { randomUUID } from 'node:crypto';

const sql = postgres(process.env.DATABASE_URL ?? 'postgresql://postgres:password123@localhost:5432/humantryx');

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
  let org = await sql`SELECT id, name, slug FROM organizations WHERE slug = 'humantryx-org' LIMIT 1`;
  if (!org.length) {
    org = await sql`
      INSERT INTO organizations (id, name, slug, logo, created_at, metadata)
      VALUES (${`org_${Date.now()}`}, 'Humantryx', 'humantryx-org', NULL, NOW(), NULL)
      RETURNING id, name, slug
    `;
  }
  const orgId = org[0].id;

  for (const config of configs) {
    let user = await sql`SELECT id, email, name, role FROM users WHERE email = ${config.email} LIMIT 1`;
    let userId = user[0]?.id;

    if (!userId) {
      const insertResult = await sql`
        INSERT INTO users (id, name, email, email_verified, image, created_at, updated_at, role, banned, ban_reason, ban_expires)
        VALUES (${`usr_${config.designation}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`}, ${config.name}, ${config.email}, true, NULL, NOW(), NOW(), 'user', false, NULL, NULL)
        RETURNING id, email, name, role
      `;
      userId = insertResult[0].id;
      user = insertResult;
    } else {
      await sql`UPDATE users SET name = ${config.name}, email_verified = true, updated_at = NOW(), role = 'user' WHERE id = ${userId}`;
    }

    const passwordHash = await hashPassword(config.password);
    const account = await sql`SELECT id FROM accounts WHERE user_id = ${userId} AND provider_id = 'credential' LIMIT 1`;

    if (account.length) {
      await sql`
        UPDATE accounts
        SET password = ${passwordHash}, account_id = ${userId}, issuer = 'local:credential', updated_at = NOW()
        WHERE user_id = ${userId} AND provider_id = 'credential'
      `;
    } else {
      await sql`
        INSERT INTO accounts (id, account_id, provider_id, user_id, access_token, refresh_token, id_token, access_token_expires_at, refresh_token_expires_at, scope, password, issuer, created_at, updated_at)
        VALUES (${`acct_${userId}`}, ${userId}, 'credential', ${userId}, NULL, NULL, NULL, NULL, NULL, NULL, ${passwordHash}, 'local:credential', NOW(), NOW())
      `;
    }

    const member = await sql`SELECT id, role FROM members WHERE user_id = ${userId} AND organization_id = ${orgId} LIMIT 1`;
    if (member.length) {
      await sql`UPDATE members SET role = ${config.memberRole}, created_at = COALESCE(created_at, NOW()) WHERE id = ${member[0].id}`;
    } else {
      await sql`
        INSERT INTO members (id, organization_id, user_id, role, created_at)
        VALUES (${`member_${Date.now()}_${Math.random().toString(36).slice(2,8)}`}, ${orgId}, ${userId}, ${config.memberRole}, NOW())
      `;
    }

    const employedMember = await sql`SELECT id FROM members WHERE user_id = ${userId} AND organization_id = ${orgId} LIMIT 1`;
    const employee = await sql`SELECT id FROM employees WHERE user_id = ${userId} AND organization_id = ${orgId} LIMIT 1`;

    if (employee.length) {
      await sql`
        UPDATE employees
        SET designation = ${config.designation}, department = ${config.department}, status = 'active', member_id = ${employedMember[0].id}, updated_at = NOW()
        WHERE id = ${employee[0].id}
      `;
    } else {
      await sql`
        INSERT INTO employees (id, user_id, organization_id, member_id, designation, department, status, created_at, updated_at)
        VALUES (${randomUUID()}, ${userId}, ${orgId}, ${employedMember[0].id}, ${config.designation}, ${config.department}, 'active', NOW(), NOW())
      `;
    }

    const result = await sql`
      SELECT u.id, u.email, u.name, u.role, a.password IS NOT NULL AS has_password, m.role AS member_role, e.designation, e.department
      FROM users u
      LEFT JOIN accounts a ON a.user_id = u.id AND a.provider_id = 'credential'
      LEFT JOIN members m ON m.user_id = u.id AND m.organization_id = ${orgId}
      LEFT JOIN employees e ON e.user_id = u.id AND e.organization_id = ${orgId}
      WHERE u.email = ${config.email}
      LIMIT 1
    `;

    console.log(`OK ${config.email}`);
    console.log(JSON.stringify(result[0], null, 2));
  }
} finally {
  await sql.end();
}
