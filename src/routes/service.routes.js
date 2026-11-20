const { Router } = require('express');
const {
  getAllServices,
  getFeaturedServices,
  getCategories,
  getServiceById,
  createService,
  updateService,
  deleteService,
  toggleAvailability,
  getMyServices,
} = require('../controllers/service.controller');
const {
  authenticate,
  requireVendor,
  requireVendorOrAdmin,
  optionalAuth,
} = require('../middleware');

const router = Router();

// Public routes
router.get('/', getAllServices);
router.get('/featured', getFeaturedServices);
router.get('/categories', getCategories);

// Vendor-specific routes (must be mounted before /:id)
router.get('/my-services', authenticate, requireVendor, getMyServices);
router.get('/vendor/my-services', authenticate, requireVendor, getMyServices);

// Single service route (public with optional auth for draft visibility)
router.get('/:id', optionalAuth, getServiceById);

// Protected mutation routes
router.post('/', authenticate, requireVendor, createService);
router.put('/:id', authenticate, requireVendorOrAdmin, updateService);
router.delete('/:id', authenticate, requireVendorOrAdmin, deleteService);
router.patch('/:id/availability', authenticate, requireVendor, toggleAvailability);

module.exports = router;
