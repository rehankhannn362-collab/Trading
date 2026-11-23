import { AuthError, authService } from '../services/authService.js';

function sendAuthError(res, error) {
  const status = error instanceof AuthError ? error.statusCode : 500;
  res.status(status).json({
    success: false,
    error: status === 500 ? 'Authentication service unavailable.' : error.message,
    ...(error instanceof AuthError ? { code: error.code } : {})
  });
}

export const authController = {
  register: async (req, res) => {
    try {
      const result = await authService.register(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      sendAuthError(res, error);
    }
  },

  login: async (req, res) => {
    try {
      const result = await authService.login(req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      sendAuthError(res, error);
    }
  },

  me: (req, res) => {
    res.json({ success: true, data: req.auth });
  },

  logout: (req, res) => {
    authService.revokeToken(req.authToken);
    res.json({ success: true, message: 'Logged out successfully.' });
  }
};
