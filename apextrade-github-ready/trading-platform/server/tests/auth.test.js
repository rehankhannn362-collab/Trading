import test from 'node:test';
import assert from 'node:assert/strict';
import { AccountRegistry } from '../src/services/accountRegistry.js';
import { AuthError, AuthService } from '../src/services/authService.js';
import { createRequireAuth } from '../src/middleware/requireAuth.js';

function createAuthService(options = {}) {
  return new AuthService({
    accountRegistry: new AccountRegistry(),
    ...options
  });
}

test('registration normalizes email, creates a private account, and returns a usable session', async () => {
  const service = createAuthService();
  const result = await service.register({
    email: '  Rehan.Example@Email.com ',
    password: 'correct-horse-battery'
  });

  assert.equal(result.user.email, 'rehan.example@email.com');
  assert.ok(result.user.id);
  assert.ok(result.user.accountId);
  assert.ok(result.token);
  assert.ok(result.expiresAt);
  assert.deepEqual(service.authenticate(result.token), result.user);
});

test('registration rejects invalid email and weak passwords', async () => {
  const service = createAuthService();

  await assert.rejects(
    service.register({ email: 'not-an-email', password: 'correct-horse-battery' }),
    error => error instanceof AuthError && error.code === 'INVALID_EMAIL'
  );
  await assert.rejects(
    service.register({ email: 'valid@example.com', password: 'short' }),
    error => error instanceof AuthError && error.code === 'INVALID_PASSWORD'
  );
});

test('email addresses are unique without regard to case or surrounding whitespace', async () => {
  const service = createAuthService();
  await service.register({ email: 'person@example.com', password: 'correct-horse-battery' });

  await assert.rejects(
    service.register({ email: ' Person@Example.com ', password: 'another-secure-password' }),
    error => error instanceof AuthError && error.statusCode === 409
  );
});

test('passwords are not stored in plaintext and login verifies the password', async () => {
  const service = createAuthService();
  await service.register({ email: 'person@example.com', password: 'correct-horse-battery' });
  const stored = service.usersByEmail.get('person@example.com');

  assert.notEqual(stored.passwordHash.toString(), 'correct-horse-battery');
  assert.notEqual(stored.passwordHash.toString(), '');
  assert.equal(stored.passwordHash.length, 64);

  const loggedIn = await service.login({
    email: 'PERSON@example.com',
    password: 'correct-horse-battery'
  });
  assert.equal(loggedIn.user.email, 'person@example.com');
  assert.ok(service.authenticate(loggedIn.token));
});

test('login returns the same credential error for unknown users and incorrect passwords', async () => {
  const service = createAuthService();
  await service.register({ email: 'person@example.com', password: 'correct-horse-battery' });

  await assert.rejects(
    service.login({ email: 'missing@example.com', password: 'correct-horse-battery' }),
    error => error.code === 'INVALID_CREDENTIALS' && error.statusCode === 401
  );
  await assert.rejects(
    service.login({ email: 'person@example.com', password: 'wrong-password-value' }),
    error => error.code === 'INVALID_CREDENTIALS' && error.statusCode === 401
  );
});

test('sessions expire and revoked tokens cannot be reused', async () => {
  let now = 1_800_000_000_000;
  const service = createAuthService({ now: () => now, tokenTtlMs: 1000 });
  const session = await service.register({
    email: 'person@example.com',
    password: 'correct-horse-battery'
  });

  assert.ok(service.authenticate(session.token));
  now += 1001;
  assert.equal(service.authenticate(session.token), null);

  const nextSession = await service.login({
    email: 'person@example.com',
    password: 'correct-horse-battery'
  });
  assert.equal(service.revokeToken(nextSession.token), true);
  assert.equal(service.authenticate(nextSession.token), null);
  assert.equal(service.revokeToken(nextSession.token), false);
});

test('authentication middleware rejects missing and invalid bearer tokens', () => {
  const middleware = createRequireAuth({ authenticate: () => null });
  const responses = [];
  const res = {
    status(code) { responses.push(code); return this; },
    json(body) { responses.push(body); return this; }
  };

  middleware({ headers: {} }, res, () => assert.fail('next must not run'));
  middleware({ headers: { authorization: 'Bearer invalid' } }, res, () => assert.fail('next must not run'));

  assert.deepEqual(responses.filter(item => typeof item === 'number'), [401, 401]);
});

test('authentication middleware attaches the verified identity and token', () => {
  const user = { id: 'user-1', email: 'person@example.com', accountId: 'account-1' };
  const middleware = createRequireAuth({ authenticate: token => token === 'a'.repeat(43) ? user : null });
  const req = { headers: { authorization: `Bearer ${'a'.repeat(43)}` } };
  let continued = false;

  middleware(req, {
    status() { return this; },
    json() { assert.fail('valid token should not return an error'); }
  }, () => { continued = true; });

  assert.equal(continued, true);
  assert.deepEqual(req.auth, user);
  assert.equal(req.authToken, 'a'.repeat(43));
});
