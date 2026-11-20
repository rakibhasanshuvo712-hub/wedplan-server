const { Router } = require('express');
const {
  getVendorOverview,
  getCustomerOverview,
} = require('../controllers/dashboard.controller');
const {
  authenticate,
  requireVendor,
  requireCustomer,
} = require('../middleware');

const router = Router();

router.get('/vendor', authenticate, requireVendor, getVendorOverview);
router.get('/customer', authenticate, requireCustomer, getCustomerOverview);

module.exports = router;
