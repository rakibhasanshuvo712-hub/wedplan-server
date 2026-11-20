const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Vendor ID is required'],
      index: true,
    },
    plan: {
      type: String,
      default: 'premium',
      required: true,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
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
    stripeSubscriptionId: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['succeeded', 'pending', 'failed'],
      default: 'succeeded',
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'transactions',
  }
);

transactionSchema.index({ vendorId: 1, createdAt: -1 });

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;
