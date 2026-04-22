import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { HttpError } from '../middleware/errorHandler.js';
import { config } from '../config.js';
import { hashSessionToken, generateSessionToken } from '../auth/session.js';
import { SessionRepository } from '../repositories/sessionRepository.js';
import { UserRepository } from '../repositories/userRepository.js';
import type { AuthenticatedUser, User } from '../types.js';

const scrypt = promisify(scryptCallback);

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const toPublicUser = (user: User): AuthenticatedUser => ({
  id: user.id,
  email: user.email,
  display_name: user.display_name ?? null,
});

const hashPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scrypt(`${password}${config.auth.passwordPepper}`, salt, 64)) as Buffer;
  return `scrypt:${salt}:${derivedKey.toString('hex')}`;
};

const verifyPassword = async (password: string, passwordHash: string): Promise<boolean> => {
  const [algorithm, salt, storedHex] = passwordHash.split(':');
  if (algorithm !== 'scrypt' || !salt || !storedHex) return false;

  const derivedKey = (await scrypt(`${password}${config.auth.passwordPepper}`, salt, 64)) as Buffer;
  const storedKey = Buffer.from(storedHex, 'hex');
  if (derivedKey.length !== storedKey.length) return false;

  return timingSafeEqual(derivedKey, storedKey);
};

const validatePassword = (password: string): void => {
  if (password.length < 8) {
    throw new HttpError(400, 'Password must be at least 8 characters long');
  }
};

export class AuthService {
  private users: UserRepository;
  private sessions: SessionRepository;

  constructor(users: UserRepository, sessions: SessionRepository) {
    this.users = users;
    this.sessions = sessions;
  }

  private buildExpiryDate(): Date {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + config.auth.sessionTtlHours);
    return expiresAt;
  }

  private async createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
    await this.sessions.deleteExpired();

    const token = generateSessionToken();
    const expiresAt = this.buildExpiryDate();
    await this.sessions.create({
      token_hash: hashSessionToken(token),
      user_id: userId,
      expires_at: expiresAt,
    });

    return { token, expiresAt };
  }

  async register(input: { email: string; password: string; display_name?: string | null }): Promise<{
    user: AuthenticatedUser;
    token: string;
    expiresAt: Date;
  }> {
    const email = normalizeEmail(input.email);
    if (!email) throw new HttpError(400, 'Email is required');
    validatePassword(input.password);

    const existing = await this.users.getByEmail(email);
    if (existing) {
      throw new HttpError(409, 'User with this email already exists');
    }

    const created = await this.users.create({
      email,
      password_hash: await hashPassword(input.password),
      display_name: input.display_name?.trim() || null,
    });

    const session = await this.createSession(created.id);
    return { user: toPublicUser(created), token: session.token, expiresAt: session.expiresAt };
  }

  async login(input: { email: string; password: string }): Promise<{
    user: AuthenticatedUser;
    token: string;
    expiresAt: Date;
  }> {
    const email = normalizeEmail(input.email);
    if (!email || !input.password) {
      throw new HttpError(400, 'Email and password are required');
    }

    const user = await this.users.getByEmail(email);
    if (!user || !(await verifyPassword(input.password, user.password_hash))) {
      throw new HttpError(401, 'Invalid email or password');
    }

    const session = await this.createSession(user.id);
    return { user: toPublicUser(user), token: session.token, expiresAt: session.expiresAt };
  }

  async getUserBySessionToken(token: string | null | undefined): Promise<AuthenticatedUser | null> {
    if (!token) return null;

    const session = await this.sessions.getActiveByTokenHash(hashSessionToken(token));
    if (!session) return null;

    const user = await this.users.getById(session.user_id);
    if (!user) return null;

    await this.sessions.touch(session.id, this.buildExpiryDate());
    return toPublicUser(user);
  }

  async logout(token: string | null | undefined): Promise<void> {
    if (!token) return;
    await this.sessions.deleteByTokenHash(hashSessionToken(token));
  }
}
