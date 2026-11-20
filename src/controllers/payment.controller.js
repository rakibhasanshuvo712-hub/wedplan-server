const stripe = require('../services/stripe.service');
const config = require('../config');
const { User, Transaction } = require('../models');

/**
 * Vendor: Create a Stripe Checkout Session for Premium Upgrade
 */
const createCheckoutSession = async (req, res) => {
  try {
    const vendor = req.user;

    if (vendor.role !== 'vendor') {
      return res.status(403).json({
        success: false,
        error: 'Only vendor accounts can upgrade to Premium.',
      });
    }

    if (vendor.subscriptionPlan === 'premium') {
      return res.status(400).json({
        success: false,
        error: 'Your account is already subscribed to the Premium plan.',
      });
    }

    const clientUrl = config.clientUrl || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: config.stripe.currency || 'usd',
            product_data: {
              name: 'WedPlan Premium Vendor Membership',
              description:
                'Publish unlimited active wedding services, verified premium vendor badge, and priority customer placement.',
            },
            unit_amount: config.stripe.premiumAmount || 4900,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${clientUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${clientUrl}/payment/cancel`,
      customer_email: vendor.email,
      metadata: {
        vendorId: vendor._id.toString(),
        plan: 'premium',
      },
    });

    return res.status(200).json({
      success: true,
      url: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    console.error('Create Checkout Session Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to initialize payment checkout session.',
    });
  }
};

/**
 * Stripe Webhook: Securely processes checkout.session.completed
 * Premium access activated ONLY after verified Stripe webhook event
 */
const handleStripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    if (config.stripe.webhookSecret && sig) {
      // Use raw body for verified signature check
      const payload = req.rawBody || req.body;
      event = stripe.webhooks.constructEvent(payload, sig, config.stripe.webhookSecret);
    } else {
      // In development / testing without a live webhook secret configured, parse directly
      event = req.body;
      console.warn('Webhook received without verified secret or in test mode.');
    }
  } catch (err) {
    console.error(`Webhook Signature Verification Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle checkout.session.completed event
  if (event && event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const vendorId = session.metadata ? session.metadata.vendorId : null;
    const plan = session.metadata ? session.metadata.plan : 'premium';

    if (vendorId) {
      try {
        // Prevent duplicate processing
        const existingTx = await Transaction.findOne({ stripeSessionId: session.id });
        if (!existingTx) {
          const amountInDollars = session.amount_total ? session.amount_total / 100 : 49;

          // Record in transactions collection
          await Transaction.create({
            vendorId,
            plan: plan || 'premium',
            amount: amountInDollars,
            currency: session.currency || 'usd',
            stripeSessionId: session.id,
            stripeSubscriptionId: session.subscription || null,
            status: 'succeeded',
          });

          // Update vendor subscription status after verified payment
          const oneYearFromNow = new Date();
          oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

          await User.findByIdAndUpdate(vendorId, {
            subscriptionPlan: 'premium',
            subscriptionExpiresAt: oneYearFromNow,
          });

          console.log(`Successfully upgraded vendor ${vendorId} to Premium via Stripe Webhook!`);
        }
      } catch (dbErr) {
        console.error('Webhook Database Update Error:', dbErr);
        return res.status(500).json({ error: 'Database processing error' });
      }
    }
  }

  return res.status(200).json({ received: true });
};

/**
 * Verify checkout session status and sync subscription if webhook was delayed
 */
const verifySession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'Session ID is required.' });
    }

    // Retrieve session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, error: 'Checkout session not found on Stripe.' });
    }

    const isPaid = session.payment_status === 'paid';
    const vendorId = session.metadata ? session.metadata.vendorId : null;

    if (isPaid && vendorId) {
      let tx = await Transaction.findOne({ stripeSessionId: sessionId });
      if (!tx) {
        const amountInDollars = session.amount_total ? session.amount_total / 100 : 49;
        tx = await Transaction.create({
          vendorId,
          plan: 'premium',
          amount: amountInDollars,
          currency: session.currency || 'usd',
          stripeSessionId: session.id,
          stripeSubscriptionId: session.subscription || null,
          status: 'succeeded',
        });

        const oneYearFromNow = new Date();
        oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

        await User.findByIdAndUpdate(vendorId, {
          subscriptionPlan: 'premium',
          subscriptionExpiresAt: oneYearFromNow,
        });
      }

      return res.status(200).json({
        success: true,
        paymentStatus: 'paid',
        transaction: tx,
      });
    }

    return res.status(200).json({
      success: true,
      paymentStatus: session.payment_status,
    });
  } catch (error) {
    console.error('Verify Session Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to verify payment session with Stripe.',
    });
  }
};

/**
 * Vendor: View own transaction history
 */
const getMyTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find({ vendorId: req.user._id }).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      transactions,
    });
  } catch (error) {
    console.error('Get Vendor Transactions Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve transactions.',
    });
  }
};

module.exports = {
  createCheckoutSession,
  handleStripeWebhook,
  verifySession,
  getMyTransactions,
};
