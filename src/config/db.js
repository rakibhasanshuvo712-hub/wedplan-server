const mongoose = require('mongoose');
const config = require('./index');

let isConnected = false;

const connectDB = async () => {
  if (isConnected) {
    return mongoose.connection;
  }

  const uri = config.dbUri;
  if (!uri) {
    console.warn('MongoDB URI is not defined in environment variables.');
    return null;
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
    });

    isConnected = conn.connections[0].readyState === 1;
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn.connection;
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    if (config.env === 'production') {
      process.exit(1);
    }
    return null;
  }
};

const disconnectDB = async () => {
  if (isConnected) {
    await mongoose.disconnect();
    isConnected = false;
    console.log('MongoDB Disconnected');
  }
};

module.exports = { connectDB, disconnectDB };
