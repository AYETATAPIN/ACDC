import { createClient, RedisClientType } from 'redis';
import { config } from './config.js';

let client: RedisClientType | null = null;

export const getRedis = (): RedisClientType => {
  if (client) return client;
  const url = config.redis.url ?? `redis://${config.redis.host}:${config.redis.port}`;
  client = createClient({ url });
  client.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('Redis Client Error', err);
  });
  return client;
};

export const initRedis = async (): Promise<void> => {
  const c = getRedis();
  if (!c.isOpen) {
    await c.connect();
  }
};

