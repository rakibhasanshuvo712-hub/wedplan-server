const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const routes = require('./routes');
const { errorHandler } = require('./middleware');
const config = require('./config');

const app = express();

// ===== Global Middleware =====
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, postman) or configured origins
      if (!origin || config.corsOrigin === '*' || (Array.isArray(config.corsOrigin) && config.corsOrigin.includes(origin))) {
        callback(null, true);
      } else {
        callback(null, true); // Permissive in dev to prevent CORS issues
      }
    },
    credentials: true,
  })
);

// Capture raw body for Stripe webhook verification
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true }));

if (config.env !== 'test') {
  app.use(morgan('dev'));
}

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ===== Routes =====
app.use('/api', routes);

// ===== Error Handler =====
app.use(errorHandler);

module.exports = app;
