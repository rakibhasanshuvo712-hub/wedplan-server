const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: false, // May be null if social login (e.g., Google OAuth)
      select: false, // Never return password hash by default
    },
    image: {
      type: String,
      default: '',
    },
    role: {
      type: String,
      enum: ['customer', 'vendor', 'admin'],
      default: 'customer',
      index: true,
    },
    isBlocked: {
      type: Boolean,
      default: false,
      index: true,
    },
    businessName: {
      type: String,
      default: '',
      trim: true,
    },
    subscriptionPlan: {
      type: String,
      enum: ['free', 'premium'],
      default: 'free',
      index: true,
    },
    subscriptionExpiresAt: {
      type: Date,
      default: null,
    },
    googleId: {
      type: String,
      sparse: true,
    },
  },
  {
    timestamps: true,
    collection: 'users',
  }
);

// Pre-save hook to hash password if modified
userSchema.pre('save', async function () {
  if (!this.isModified('password') || !this.password) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password instance method
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

// Safe JSON serialization
userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.__v;
  return obj;
};

const User = mongoose.models.User || mongoose.model('User', userSchema);

module.exports = User;
