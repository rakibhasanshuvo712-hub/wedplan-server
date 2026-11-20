const Stripe = require('stripe');
const config = require('../config');

const stripe = Stripe(config.stripe.secretKey || 'sk_test_placeholder');

module.exports = stripe;
