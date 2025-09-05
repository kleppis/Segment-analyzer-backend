import "dotenv/config";

function required(name: string, val: string | undefined): string {
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: Number(process.env.PORT ?? 3000),
  DATABASE_URL: required("DATABASE_URL", process.env.DATABASE_URL),
  ALLOWED_ORIGIN: required("ALLOWED_ORIGIN", process.env.ALLOWED_ORIGIN), // e.g. https://yourapp.vercel.app
  LOG_LEVEL: process.env.LOG_LEVEL ?? "info",
};
