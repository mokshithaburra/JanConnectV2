export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "",
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  isProduction: process.env.NODE_ENV === "production",
};

const REQUIRED = ["DATABASE_URL", "JWT_SECRET", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"];
const REQUIRED_IN_PRODUCTION = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];

// Called once at server startup (not on import, so tests and scripts can load
// modules without a full environment).
export function assertEnv() {
  const names = ENV.isProduction ? [...REQUIRED, ...REQUIRED_IN_PRODUCTION] : REQUIRED;
  const missing = names.filter(name => !process.env[name]);
  const problems = missing.length > 0 ? [`missing ${missing.join(", ")}`] : [];

  if (ENV.isProduction && ENV.cookieSecret && ENV.cookieSecret.length < 32) {
    problems.push("JWT_SECRET must be at least 32 characters in production");
  }

  if (problems.length > 0) {
    throw new Error(`Invalid environment: ${problems.join("; ")}`);
  }
}