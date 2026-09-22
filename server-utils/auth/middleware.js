/**
 * Auth Middleware — Adapted for Next.js API Routes
 *
 * Instead of Express req/res/next, this exports a helper that
 * validates JWT tokens from Next.js Request headers.
 */

const { verifyToken } = require('./jwt');

/**
 * Validate a JWT token from a Next.js Request object.
 * @param {Request} request - Next.js Request object
 * @returns {{ user: Object } | { error: string, status: number }}
 */
function validateToken(request) {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      error: 'Missing or invalid Authorization header.',
      status: 401,
    };
  }

  const token = authHeader.slice(7);

  try {
    const decoded = verifyToken(token);
    return {
      user: {
        id: decoded.id,
        email: decoded.email,
        name: decoded.name,
      },
    };
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return { error: 'Token has expired. Please login again.', status: 401 };
    }
    return { error: 'Invalid authentication token.', status: 401 };
  }
}

// Keep Express middleware for backward compatibility
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Missing Authorization header.' });
  }
  const token = authHeader.slice(7);
  try {
    const decoded = verifyToken(token);
    req.user = { id: decoded.id, email: decoded.email, name: decoded.name };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid token.' });
  }
}

module.exports = { validateToken, requireAuth };
