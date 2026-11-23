import { authService } from '../services/authService.js';

export function createRequireAuth(service = authService) {
  return (req, res, next) => {
    const header = req.headers?.authorization ?? req.get?.('authorization');
    const match = typeof header === 'string'
      ? header.match(/^Bearer\s+([A-Za-z0-9_-]{40,128})$/i)
      : null;

    if (!match) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.',
        code: 'AUTHENTICATION_REQUIRED'
      });
    }

    const token = match[1];
    const user = service.authenticate(token);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Session is invalid or expired. Please log in again.',
        code: 'INVALID_SESSION'
      });
    }

    req.auth = user;
    req.authToken = token;
    return next();
  };
}

export const requireAuth = createRequireAuth();
