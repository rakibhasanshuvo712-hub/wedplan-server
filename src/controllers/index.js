const authController = require('./auth.controller');
const serviceController = require('./service.controller');
const bookingController = require('./booking.controller');
const paymentController = require('./payment.controller');
const adminController = require('./admin.controller');

const health = (req, res) => {
  res.json({
    status: 'ok',
    service: 'WedPlan Wedding Planning Platform API',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
};

module.exports = {
  health,
  authController,
  serviceController,
  bookingController,
  paymentController,
  adminController,
};
