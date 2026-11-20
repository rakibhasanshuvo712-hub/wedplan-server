const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  corsOrigin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  dbUri: process.env.DB_URI,
  jwt: {
    secret: process.env.JWT_SECRET || 'wedplan_fallback_secret_key_change_in_prod',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    premiumAmount: 4900, // $49.00 USD in cents
    currency: 'usd',
  },
  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@wedplan.com',
    password: process.env.ADMIN_PASSWORD || 'Admin@123456',
    name: process.env.ADMIN_NAME || 'WedPlan Admin',
  },
  imgbb: {
    apiKey: process.env.IMGBB_API_KEY,
  },
};

module.exports = config;
