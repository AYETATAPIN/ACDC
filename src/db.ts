import {Pool} from 'pg';
import {config} from './config.js';

let pool: Pool;

export const getPool = (): Pool => {
    if (pool) return pool;

    if (config.db.url) {
        pool = new Pool({connectionString: config.db.url, ssl: config.db.ssl});
    } else {
        pool = new Pool({
            host: config.db.host,
            port: config.db.port,
            user: config.db.user,
            password: config.db.password,
            database: config.db.database,
            ssl: config.db.ssl,
        });
    }
    return pool;
};

export const initDb = async (): Promise<void> => {
    const p = getPool();
    // Simple connectivity check
    await p.query('SELECT 1');
};

