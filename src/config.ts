import dotenv from 'dotenv';

dotenv.config();

const parseIntEnv = (val: string | undefined, def: number): number => {
  const n = Number(val);
  return Number.isFinite(n) ? n : def;
};

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseIntEnv(process.env.PORT, 3000),

  db: {
    url: process.env.DATABASE_URL,
    host: process.env.DB_HOST || 'db',
    port: parseIntEnv(process.env.DB_PORT, 5432),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'acdc',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  },

} as const;
