import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is not set, cannot run migrations.");
  process.exit(1);
}

// A single connection avoids advisory-lock contention when several
// containers boot at once.
const sql = postgres(databaseUrl, { max: 1 });

try {
  await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
  console.log("Migrations applied.");
} catch (error) {
  console.error("Migration failed:", error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
