import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is not set, cannot run migrations.");
  process.exit(1);
}

const quoteIdent = (name) => `"${name.replace(/"/g, '""')}"`;

/**
 * Connect to the default "postgres" database and create the target DB if
 * missing. CREATE DATABASE cannot run against a non-existent database.
 */
async function ensureDatabase(urlString) {
  const url = new URL(urlString);
  const dbName = decodeURIComponent(url.pathname.replace(/^\//, ""));

  if (!dbName) {
    throw new Error("DATABASE_URL has no database name");
  }

  // Already connecting to the maintenance DB — nothing to create.
  if (dbName === "postgres" || dbName === "template0" || dbName === "template1") {
    return;
  }

  const adminUrl = new URL(urlString);
  adminUrl.pathname = "/postgres";

  const admin = postgres(adminUrl.toString(), { max: 1 });
  try {
    const existing = await admin`
      SELECT 1 FROM pg_database WHERE datname = ${dbName}
    `;

    if (existing.length === 0) {
      console.log(`Creating database ${quoteIdent(dbName)}...`);
      await admin.unsafe(`CREATE DATABASE ${quoteIdent(dbName)}`);
      console.log(`Database ${quoteIdent(dbName)} created.`);
    }
  } finally {
    await admin.end({ timeout: 5 });
  }
}

try {
  await ensureDatabase(databaseUrl);

  // A single connection avoids advisory-lock contention when several
  // containers boot at once.
  const sql = postgres(databaseUrl, { max: 1 });
  try {
    console.log("Running Drizzle migrations...");
    await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
    console.log("Migrations applied.");
  } finally {
    await sql.end({ timeout: 5 });
  }
} catch (error) {
  console.error("Migration failed:", error);
  process.exit(1);
}
