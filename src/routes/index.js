const { Router } = require('express');
const { health } = require('../controllers');
const { notFound } = require('../middleware');

const authRoutes = require('./auth.routes');
const serviceRoutes = require('./service.routes');
const bookingRoutes = require('./booking.routes');
const paymentRoutes = require('./payment.routes');
const adminRoutes = require('./admin.routes');
const dashboardRoutes = require('./dashboard.routes');
const uploadRoutes = require('./upload.routes');
const { getVendorOverview, getCustomerOverview } = require('../controllers/dashboard.controller');
const { authenticate, requireVendor, requireCustomer } = require('../middleware');

const router = Router();

router.get('/health', health);

router.use('/auth', authRoutes);
router.use('/services', serviceRoutes);
router.use('/bookings', bookingRoutes);
router.use('/payments', paymentRoutes);
router.use('/admin', adminRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/upload', uploadRoutes);

// Direct role overview shortcuts
router.get('/vendor/overview', authenticate, requireVendor, getVendorOverview);
router.get('/customer/overview', authenticate, requireCustomer, getCustomerOverview);

router.use(notFound);

module.exports = router;
