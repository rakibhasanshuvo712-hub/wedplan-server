const {
  authenticate,
  authorize,
  requireAdmin,
  requireVendor,
  requireCustomer,
  requireVendorOrAdmin,
  optionalAuth,
} = require('./auth.middleware');

const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    error: `Resource not found - ${req.originalUrl}`,
  });
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  console.error('Unhandled Application Error:', err);

  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  // Specific handling for mongoose cast errors / duplicate key
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: `Invalid format for resource ID: ${err.value}`,
    });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(409).json({
      success: false,
      error: `A record with this ${field} already exists.`,
    });
  }

  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((val) => val.message);
    return res.status(400).json({
      success: false,
      error: messages.join(', '),
    });
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = {
  notFound,
  errorHandler,
  authenticate,
  authorize,
  requireAdmin,
  requireVendor,
  requireCustomer,
  requireVendorOrAdmin,
  optionalAuth,
};
