const { verifyToken } = require('../utils/jwt');
const { User } = require('../models');

/**
 * Middleware to authenticate requests using JWT
 */
const authenticate = async (req, res, next) => {
  try {
    let token = null;

    // 1. Check Authorization header: Bearer <token>
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.headers['x-access-token']) {
      token = req.headers['x-access-token'];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. No token provided.',
      });
    }

    const decoded = verifyToken(token);
    if (!decoded || !decoded.id) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired authentication token.',
      });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User account associated with this token no longer exists.',
      });
    }

    // Blocked users must not access protected platform features
    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        error: 'Your account has been blocked. Access to protected features is restricted.',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth Middleware Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal authentication error.',
    });
  }
};

/**
 * Middleware to restrict access to specific roles
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Access restricted to [${allowedRoles.join(', ')}] roles only.`,
      });
    }

    next();
  };
};

/**
 * Optional authentication: attaches req.user if a valid token is provided,
 * otherwise proceeds with req.user = null without throwing 401.
 */
const optionalAuth = async (req, res, next) => {
  try {
    let token = null;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.headers['x-access-token']) {
      token = req.headers['x-access-token'];
    }

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = verifyToken(token);
    if (decoded && decoded.id) {
      const user = await User.findById(decoded.id);
      if (user && !user.isBlocked) {
        req.user = user;
      } else {
        req.user = null;
      }
    } else {
      req.user = null;
    }
    next();
  } catch (error) {
    req.user = null;
    next();
  }
};

module.exports = {
  authenticate,
  authorize,
  requireAdmin: authorize('admin'),
  requireVendor: authorize('vendor'),
  requireCustomer: authorize('customer'),
  requireVendorOrAdmin: authorize('vendor', 'admin'),
  optionalAuth,
};
