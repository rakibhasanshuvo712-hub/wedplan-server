const { Router } = require('express');
const {
  createCheckoutSession,
  handleStripeWebhook,
  verifySession,
  getMyTransactions,
} = require('../controllers/payment.controller');
const { authenticate, requireVendor } = require('../middleware');

const router = Router();

// Webhook endpoint (handled before global json middleware where raw body is preserved)
router.post('/webhook', handleStripeWebhook);

// Protected vendor routes
router.post('/create-checkout-session', authenticate, requireVendor, createCheckoutSession);
router.get('/verify-session/:sessionId', authenticate, verifySession);
router.get('/my-transactions', authenticate, requireVendor, getMyTransactions);

module.exports = router;
