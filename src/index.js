require('dotenv').config();

const app = require('./app');
const config = require('./config');
const { connectDB } = require('./config/db');
const { seedDatabase } = require('./utils/seed');

const PORT = config.port;

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Auto-seed required admin & sample services if DB is fresh
    await seedDatabase();

    app.listen(PORT, () => {
      console.log(`WedPlan API Server running in ${config.env} mode on port ${PORT}`);
      console.log(`Connected with Client URL: ${config.clientUrl}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
