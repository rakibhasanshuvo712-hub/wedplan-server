const { betterAuth } = require('better-auth');
const { mongodbAdapter } = require('better-auth/adapters/mongodb');
const { toNodeHandler } = require('better-auth/node');
const mongoose = require('mongoose');

let authInstance = null;

const getAuth = () => {
  if (authInstance) return authInstance;

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection not established for Better Auth');
  }

  authInstance = betterAuth({
    database: mongodbAdapter(db),
    secret: process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET || 'wedplan_better_auth_secret_production_2026',
    baseURL: process.env.BETTER_AUTH_URL || 'https://wedplan-backend-inky.vercel.app',
    basePath: '/api/auth',
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      },
    },
    user: {
      additionalFields: {
        role: {
          type: 'string',
          required: false,
          defaultValue: 'customer',
        },
        subscriptionPlan: {
          type: 'string',
          required: false,
          defaultValue: 'free',
        },
      },
    },
  });

  return authInstance;
};

const betterAuthMiddleware = async (req, res, next) => {
  try {
    const auth = getAuth();
    return toNodeHandler(auth)(req, res);
  } catch (err) {
    console.error('Better Auth Middleware Error:', err);
    return next(err);
  }
};

module.exports = {
  getAuth,
  betterAuthMiddleware,
};
