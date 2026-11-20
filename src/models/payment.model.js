const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Vendor ID is required'],
      index: true,
    },
    customerEmail: {
      type: String,
      required: [true, 'Customer email is required'],
      lowercase: true,
      trim: true,
      index: true,
    },
    plan: {
      type: String,
      default: 'premium',
      required: true,
    },
    amount: {
      type: Number,
      required: [true, 'Payment amount is required'],
    },
    currency: {
      type: String,
      default: 'usd',
      lowercase: true,
    },
    stripeSessionId: {
      type: String,
      required: [true, 'Stripe Session ID is required'],
      unique: true,
      index: true,
    },
    stripePaymentIntentId: {
      type: String,
      default: null,
    },
    paymentMethod: {
      type: String,
      default: 'card',
    },
    status: {
      type: String,
      enum: ['succeeded', 'pending', 'failed'],
      default: 'succeeded',
      index: true,
    },
    billingDetails: {
      name: { type: String, default: '' },
      email: { type: String, default: '' },
      address: { type: String, default: '' },
    },
    receiptUrl: {
      type: String,
      default: '',
    },
    description: {
      type: String,
      default: 'WedPlan Premium Vendor Membership (1 Year)',
    },
  },
  {
    timestamps: true,
    collection: 'payments',
  }
);

paymentSchema.index({ vendorId: 1, createdAt: -1 });

const Payment = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);

module.exports = Payment;
