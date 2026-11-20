const { Router } = require('express');
const { health } = require('../controllers');
const { notFound } = require('../middleware');

const authRoutes = require('./auth.routes');
const serviceRoutes = require('./service.routes');
const bookingRoutes = require('./booking.routes');
const paymentRoutes = require('./payment.routes');
const adminRoutes = require('./admin.routes');

const router = Router();

router.get('/health', health);

router.use('/auth', authRoutes);
router.use('/services', serviceRoutes);
router.use('/bookings', bookingRoutes);
router.use('/payments', paymentRoutes);
router.use('/admin', adminRoutes);

router.use(notFound);

module.exports = router;
