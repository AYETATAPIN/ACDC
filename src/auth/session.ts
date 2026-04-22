import type { Response } from 'express';
import { createHash, randomBytes } from 'node:crypto';
import { config } from '../config.js';

const toCookieDate = (value: Date): string => value.toUTCString();

export const generateSessionToken = (): string => randomBytes(32).toString('base64url');

export const hashSessionToken = (token: string): string => createHash('sha256').update(token).digest('hex');

export const parseCookies = (header: string | undefined): Record<string, string> => {
  if (!header) return {};

  return header.split(';').reduce<Record<string, string>>((acc, chunk) => {
    const separatorIndex = chunk.indexOf('=');
    if (separatorIndex <= 0) return acc;

    const key = chunk.slice(0, separatorIndex).trim();
    const value = chunk.slice(separatorIndex + 1).trim();
    if (!key) return acc;

    acc[key] = decodeURIComponent(value);
    return acc;
  }, {});
};

const buildCookie = (name: string, value: string, expiresAt: Date): string => {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Expires=${toCookieDate(expiresAt)}`,
  ];

  if (config.env === 'production') {
    parts.push('Secure');
  }

  return parts.join('; ');
};

export const setSessionCookie = (res: Response, token: string, expiresAt: Date): void => {
  res.setHeader('Set-Cookie', buildCookie(config.auth.sessionCookieName, token, expiresAt));
};

export const clearSessionCookie = (res: Response): void => {
  res.setHeader('Set-Cookie', buildCookie(config.auth.sessionCookieName, '', new Date(0)));
};
