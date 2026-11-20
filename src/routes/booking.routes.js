const { Router } = require('express');
const {
  createBooking,
  getCustomerBookings,
  getVendorBookings,
  cancelBooking,
  updateBookingStatus,
  getBookingById,
} = require('../controllers/booking.controller');
const {
  authenticate,
  requireCustomer,
  requireVendor,
} = require('../middleware');

const router = Router();

// Customer routes
router.post('/', authenticate, requireCustomer, createBooking);
router.get('/my-bookings', authenticate, requireCustomer, getCustomerBookings);
router.patch('/:id/cancel', authenticate, requireCustomer, cancelBooking);

// Vendor routes
router.get('/vendor-requests', authenticate, requireVendor, getVendorBookings);
router.patch('/:id/status', authenticate, requireVendor, updateBookingStatus);

// Common detail route
router.get('/:id', authenticate, getBookingById);

module.exports = router;
