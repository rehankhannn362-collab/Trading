import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  scryptSync,
  timingSafeEqual
} from 'node:crypto';
import { promisify } from 'node:util';
import { accountRegistry as defaultAccountRegistry } from './accountRegistry.js';

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const DUMMY_SALT = 'apextrade-auth-dummy-salt';
const DUMMY_HASH = scryptSync('not-a-real-user-password', DUMMY_SALT, KEY_LENGTH, SCRYPT_OPTIONS);

export class AuthError extends Error {
  constructor(message, statusCode = 400, code = 'AUTH_ERROR') {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function normalizeEmail(email) {
  if (typeof email !== 'string') return null;
  const normalized = email.trim().toLowerCase();
  if (
    normalized.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
  ) return null;
  return normalized;
}

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) {
    throw new AuthError('Password must be between 12 and 128 characters.', 400, 'INVALID_PASSWORD');
  }
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function toPublicUser(user) {
  return {
    id: user.id,
    email: user.email,
    accountId: user.accountId,
    createdAt: user.createdAt
  };
}

export class AuthService {
  constructor({
    accountRegistry = defaultAccountRegistry,
    tokenTtlMs = TOKEN_TTL_MS,
    now = () => Date.now()
  } = {}) {
    this.accountRegistry = accountRegistry;
    this.tokenTtlMs = tokenTtlMs;
    this.now = now;
    this.usersByEmail = new Map();
    this.sessionsByTokenHash = new Map();
  }

  async register({ email, password } = {}) {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      throw new AuthError('Enter a valid email address.', 400, 'INVALID_EMAIL');
    }
    validatePassword(password);
    if (this.usersByEmail.has(normalizedEmail)) {
      throw new AuthError('An account with this email already exists.', 409, 'EMAIL_ALREADY_REGISTERED');
    }

    const salt = randomBytes(16).toString('hex');
    const passwordHash = await scrypt(password, salt, KEY_LENGTH, SCRYPT_OPTIONS);
    const account = this.accountRegistry.createAccount();
    const user = {
      id: randomUUID(),
      email: normalizedEmail,
      salt,
      passwordHash,
      accountId: account.id,
      createdAt: new Date(this.now()).toISOString()
    };

    this.usersByEmail.set(normalizedEmail, user);
    return this.createSession(user);
  }

  async login({ email, password } = {}) {
    const normalizedEmail = normalizeEmail(email);
    const user = normalizedEmail ? this.usersByEmail.get(normalizedEmail) : null;
    const candidatePassword = typeof password === 'string' ? password : '';
    const salt = user?.salt ?? DUMMY_SALT;
    const expectedHash = user?.passwordHash ?? DUMMY_HASH;
    const candidateHash = await scrypt(candidatePassword, salt, KEY_LENGTH, SCRYPT_OPTIONS);
    const valid = timingSafeEqual(candidateHash, expectedHash);

    if (!user || !valid) {
      throw new AuthError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
    }
    return this.createSession(user);
  }

  authenticate(token) {
    if (typeof token !== 'string' || token.length < 40 || token.length > 128) return null;

    const tokenHash = hashToken(token);
    const session = this.sessionsByTokenHash.get(tokenHash);
    if (!session) return null;

    if (session.expiresAt <= this.now()) {
      this.sessionsByTokenHash.delete(tokenHash);
      return null;
    }

    const user = [...this.usersByEmail.values()].find(item => item.id === session.userId);
    if (!user) {
      this.sessionsByTokenHash.delete(tokenHash);
      return null;
    }
    return toPublicUser(user);
  }

  revokeToken(token) {
    if (typeof token !== 'string') return false;
    return this.sessionsByTokenHash.delete(hashToken(token));
  }

  createSession(user) {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = this.now() + this.tokenTtlMs;
    this.sessionsByTokenHash.set(hashToken(token), {
      userId: user.id,
      expiresAt
    });
    return {
      user: toPublicUser(user),
      token,
      expiresAt: new Date(expiresAt).toISOString()
    };
  }
}

export const authService = new AuthService();
