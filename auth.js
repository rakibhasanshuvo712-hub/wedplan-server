const mongoose = require('mongoose');

let authInstance = null;

const getAuth = async () => {
  if (authInstance) return authInstance;

  const { betterAuth } = await import('better-auth');
  const { mongodbAdapter } = await import('better-auth/adapters/mongodb');

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
        // The redirect-based social flow needs BOTH the client ID and its
        // matching secret. The public ID alone is only enough for the
        // token-verification flow used by POST /api/auth/google, so allow a
        // dedicated pair here instead of silently sending an empty secret.
        clientId: process.env.GOOGLE_SOCIAL_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '',
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
    const auth = await getAuth();
    const { toNodeHandler } = await import('better-auth/node');
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
