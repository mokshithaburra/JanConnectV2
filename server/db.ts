import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";
import { InsertUser, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _pool: Pool | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

// Connection-level failures (pooler dropped an idle connection, server restart)
// that are safe to retry once for read-only queries.
const TRANSIENT_CODES = new Set(["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EPIPE", "57P01", "57P03", "08000", "08003", "08006"]);

function isTransient(error: unknown) {
  const e = error as { code?: string; message?: string } | null;
  return TRANSIENT_CODES.has(e?.code ?? "") || /connection terminated|connection timeout/i.test(e?.message ?? "");
}

function sslConfig(): PoolConfig["ssl"] {
  if (!ENV.isProduction) return undefined;
  const ca = process.env.DATABASE_CA_CERT;
  if (ca) return { ca, rejectUnauthorized: true };
  console.warn("[Database] DATABASE_CA_CERT not set: TLS is on but the server certificate is not verified");
  return { rejectUnauthorized: false };
}

function createPool(connectionString: string) {
  const pool = new Pool({
    connectionString,
    ssl: sslConfig(),
    max: Number(process.env.DATABASE_POOL_MAX) || 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    keepAlive: true,
  });

  // Idle clients killed by the server emit here; unhandled, this crashes the process.
  pool.on("error", error => console.error("[Database] Idle client error:", error));

  const query = pool.query.bind(pool) as (...args: unknown[]) => Promise<unknown>;
  (pool as { query: unknown }).query = async (...args: unknown[]) => {
    try {
      return await query(...args);
    } catch (error) {
      const first = args[0] as string | { text?: string };
      const text = typeof first === "string" ? first : first?.text ?? "";
      if (!isTransient(error) || !/^\s*select\b/i.test(text)) throw error;
      console.warn("[Database] Retrying read after connection error:", (error as Error).message);
      return query(...args);
    }
  };

  return pool;
}

export async function getDb() {
  if (!_db) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Database is not configured" });
    }
    _pool = createPool(url);
    _db = drizzle(_pool);
  }
  return _db;
}

export async function pingDb() {
  const db = await getDb();
  await db.execute(sql`select 1`);
}

export async function closeDb() {
  const pool = _pool;
  _pool = null;
  _db = null;
  await pool?.end();
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Partial<InsertUser> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}
