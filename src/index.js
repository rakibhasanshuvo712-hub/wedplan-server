require('dotenv').config();

const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Stripe = require('stripe');
const multer = require('multer');

// ==========================================
// 1. CONFIGURATION
// ==========================================
const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  corsOrigin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  dbUri: process.env.DB_URI,
  jwt: {
    secret: process.env.JWT_SECRET || 'wedplan_super_secret_jwt_key_2026_secure',
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

const stripe = Stripe(config.stripe.secretKey || 'sk_test_placeholder');

// ==========================================
// 2. MONGODB DATABASE CONNECTION (SERVERLESS CACHED)
// ==========================================
let cachedConn = null;
let cachedPromise = null;

const connectDB = async () => {
  if (cachedConn && mongoose.connection.readyState === 1) {
    return cachedConn;
  }

  if (!cachedPromise) {
    const uri = config.dbUri;
    if (!uri) {
      console.warn('MongoDB URI is not defined in environment variables.');
      return null;
    }

    cachedPromise = mongoose
      .connect(uri, {
        bufferCommands: false,
        serverSelectionTimeoutMS: 10000,
      })
      .then((m) => {
        cachedConn = m.connection;
        console.log(`MongoDB Connected: ${cachedConn.host}`);
        return cachedConn;
      })
      .catch((err) => {
        cachedPromise = null;
        throw err;
      });
  }

  try {
    cachedConn = await cachedPromise;
    return cachedConn;
  } catch (error) {
    cachedPromise = null;
    console.error(`MongoDB Connection Error: ${error.message}`);
    return null;
  }
};

const disconnectDB = async () => {
  if (cachedConn || mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    cachedConn = null;
    cachedPromise = null;
    console.log('MongoDB Disconnected');
  }
};

// ==========================================
// 3. MONGOOSE DATA MODELS
// ==========================================
const modelsPath = fs.existsSync(path.join(__dirname, 'src/models'))
  ? './src/models'
  : './models';
const { User, Service, serviceCategories, Booking, Transaction } = require(modelsPath);

// ==========================================
// 4. JWT & AUTHENTICATION MIDDLEWARES
// ==========================================
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
      name: user.name,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.secret);
  } catch (error) {
    return null;
  }
};

const validatePassword = (password) => {
  if (!password || typeof password !== 'string') return false;
  if (password.length < 6) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  return true;
};

// Authentication Middleware
const authenticate = async (req, res, next) => {
  try {
    let token = null;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.headers['x-access-token']) {
      token = req.headers['x-access-token'];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({ success: false, error: 'Authentication required. No token provided.' });
    }

    const decoded = verifyToken(token);
    if (!decoded || !decoded.id) {
      return res.status(401).json({ success: false, error: 'Invalid or expired authentication token.' });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, error: 'User account associated with this token no longer exists.' });
    }

    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        error: 'Your account has been blocked. Access to protected features is restricted.',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Internal authentication error.' });
  }
};

// Role Authorization Middleware
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Access restricted to [${allowedRoles.join(', ')}] roles only.`,
      });
    }
    next();
  };
};

const requireAdmin = authorize('admin');
const requireVendor = authorize('vendor');
const requireCustomer = authorize('customer');
const requireVendorOrAdmin = authorize('vendor', 'admin');

// Optional Authentication Middleware
const optionalAuth = async (req, res, next) => {
  try {
    let token = null;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.headers['x-access-token']) {
      token = req.headers['x-access-token'];
    }

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = verifyToken(token);
    if (decoded && decoded.id) {
      const user = await User.findById(decoded.id);
      req.user = user && !user.isBlocked ? user : null;
    } else {
      req.user = null;
    }
    next();
  } catch (err) {
    req.user = null;
    next();
  }
};

// ==========================================
// 5. DATABASE SEEDER (ADMIN & SAMPLE DATA)
// ==========================================
const seedDatabase = async () => {
  try {
    const adminEmail = (config.admin.email || 'admin@wedplan.com').toLowerCase();
    let admin = await User.findOne({ email: adminEmail });
    if (!admin) {
      admin = await User.create({
        name: config.admin.name || 'WedPlan Admin',
        email: adminEmail,
        password: config.admin.password || 'Admin@123456',
        role: 'admin',
        isBlocked: false,
        subscriptionPlan: 'premium',
      });
      console.log(`Admin user seeded: ${adminEmail}`);
    } else if (admin.role !== 'admin') {
      admin.role = 'admin';
      await admin.save();
    }

    // Seed sample vendor if not exists
    let vendor = await User.findOne({ email: 'vendor@wedplan.com' });
    if (!vendor) {
      vendor = await User.create({
        name: 'Grand Elegance Weddings',
        email: 'vendor@wedplan.com',
        password: 'Vendor@123456',
        role: 'vendor',
        businessName: 'Grand Elegance Studios',
        subscriptionPlan: 'premium',
        isBlocked: false,
      });
    }

    // Seed sample customer if not exists
    let customer = await User.findOne({ email: 'customer@wedplan.com' });
    if (!customer) {
      customer = await User.create({
        name: 'Sarah & Michael',
        email: 'customer@wedplan.com',
        password: 'Customer@123456',
        role: 'customer',
        isBlocked: false,
      });
    }

    // Seed sample services if empty
    const serviceCount = await Service.countDocuments();
    if (serviceCount === 0 && vendor) {
      const sampleServices = [
        {
          vendorId: vendor._id,
          serviceName: 'The Grand Palace Ballroom & Gardens',
          category: 'Wedding Venues',
          description: 'A breathtaking venue featuring crystal chandeliers, panoramic marble staircases, and manicured gardens.',
          price: 3500,
          location: 'Beverly Hills, CA',
          images: [
            'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1200&q=80',
            'https://images.unsplash.com/photo-1544077960-604201fe74bc?auto=format&fit=crop&w=1200&q=80',
          ],
          status: 'approved',
          isActive: true,
        },
        {
          vendorId: vendor._id,
          serviceName: 'Cinematic Romance 4K Photography & Drone',
          category: 'Photography & Videography',
          description: 'Full-day luxury wedding coverage with 2 lead photographers, drone aerials, and 20-min feature film.',
          price: 2200,
          location: 'San Francisco, CA',
          images: [
            'https://images.unsplash.com/photo-1537633552985-df8429e8048b?auto=format&fit=crop&w=1200&q=80',
            'https://images.unsplash.com/photo-1606800052052-a08af7148866?auto=format&fit=crop&w=1200&q=80',
          ],
          status: 'approved',
          isActive: true,
        },
        {
          vendorId: vendor._id,
          serviceName: 'Enchanted Rose Botanical Decor & Styling',
          category: 'Decoration & Florist',
          description: 'Custom floral arches, romantic bridal bouquets, luxury hanging floral installations, and fairy lights.',
          price: 1800,
          location: 'Napa Valley, CA',
          images: [
            'https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&w=1200&q=80',
          ],
          status: 'approved',
          isActive: true,
        },
        {
          vendorId: vendor._id,
          serviceName: 'Haute Cuisine 5-Course Plated Wedding Feast',
          category: 'Catering Services',
          description: 'Exquisite fine-dining catering curated by Michelin-trained chefs with artisanal wedding cake.',
          price: 4200,
          location: 'Los Angeles, CA',
          images: [
            'https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=1200&q=80',
          ],
          status: 'approved',
          isActive: true,
        },
        {
          vendorId: vendor._id,
          serviceName: 'Radiant Glow Bridal Hair & Airbrush Makeup',
          category: 'Makeup & Styling',
          description: 'High-end bridal glamour including trial session, HD airbrush makeup, and luxury lash extensions.',
          price: 950,
          location: 'San Diego, CA',
          images: [
            'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=1200&q=80',
          ],
          status: 'approved',
          isActive: true,
        },
        {
          vendorId: vendor._id,
          serviceName: 'Atelier Couture Bridal Gowns & Tuxedos',
          category: 'Wedding Fashion',
          description: 'Handcrafted designer wedding dresses, French lace veils, and custom-tailored Italian wool tuxedos.',
          price: 2800,
          location: 'Newport Beach, CA',
          images: [
            'https://images.unsplash.com/photo-1594552072238-b8a33785b261?auto=format&fit=crop&w=1200&q=80',
          ],
          status: 'approved',
          isActive: true,
        },
      ];
      await Service.insertMany(sampleServices);
      console.log('Sample wedding services seeded successfully.');
    }
  } catch (err) {
    console.error('Seeder Error:', err.message);
  }
};

// ==========================================
// 6. EXPRESS APP & MIDDLEWARES
// ==========================================
const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || config.corsOrigin === '*' || (Array.isArray(config.corsOrigin) && config.corsOrigin.includes(origin))) {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-access-token', 'stripe-signature'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

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

// Serverless Database Connection & Seed Middleware
let isSeeded = false;
app.use(async (req, res, next) => {
  try {
    await connectDB();
    if (!isSeeded) {
      isSeeded = true;
      seedDatabase().catch((e) => console.error('Seeder background error:', e.message));
    }
    next();
  } catch (err) {
    console.error('Serverless connection error:', err);
    next();
  }
});

// Root API Endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'WedPlan — Wedding Planning Platform API',
    status: 'online',
    version: '1.0.0',
    documentation: '/api/health',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      services: '/api/services',
      bookings: '/api/bookings',
      payments: '/api/payments',
      admin: '/api/admin',
    },
  });
});

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Multer upload config
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed!'), false);
  },
});

// ==========================================
// 7. ALL API ROUTES & HANDLERS (IN INDEX.JS)
// ==========================================
const apiRouter = express.Router();

// --- HEALTH CHECK ---
const healthHandler = (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date() });
};
apiRouter.get('/health', healthHandler);
app.get('/health', healthHandler);

// --- AUTHENTICATION APIS ---
// Register
const registerHandler = async (req, res) => {
  try {
    const { name, email, password, image, role, businessName } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Full name, email, and password are required.' });
    }

    const selectedRole = role ? role.toLowerCase() : 'customer';
    if (selectedRole === 'admin') {
      return res.status(403).json({ success: false, error: 'Administrator accounts cannot be created publicly.' });
    }
    if (!['customer', 'vendor'].includes(selectedRole)) {
      return res.status(400).json({ success: false, error: 'Role must be either "customer" or "vendor".' });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters and contain at least one uppercase letter and one lowercase letter.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ success: false, error: 'An account with this email address already exists.' });
    }

    const newUser = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      image: image || '',
      role: selectedRole,
      businessName: selectedRole === 'vendor' ? (businessName || '').trim() : '',
      subscriptionPlan: 'free',
      isBlocked: false,
    });

    const token = generateToken(newUser);
    return res.status(201).json({
      success: true,
      message: 'Registration successful! Welcome to WedPlan.',
      token,
      user: newUser.toSafeObject(),
      data: { user: newUser.toSafeObject(), token },
    });
  } catch (error) {
    console.error('Registration Error:', error);
    return res.status(500).json({ success: false, error: 'Registration failed. Please try again.' });
  }
};

// Login
const loginHandler = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid email or password credentials.' });
    }

    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        error: 'Your account has been blocked by administrators. Access is prohibited.',
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid email or password credentials.' });
    }

    const token = generateToken(user);
    return res.status(200).json({
      success: true,
      message: 'Logged in successfully.',
      token,
      user: user.toSafeObject(),
      data: { user: user.toSafeObject(), token },
    });
  } catch (error) {
    console.error('Login Error:', error);
    return res.status(500).json({ success: false, error: 'An error occurred during login.' });
  }
};

// Google OAuth
const googleAuthHandler = async (req, res) => {
  try {
    const { email, name, image, role, googleId } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required for Google authentication.' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (normalizedEmail === (config.admin.email || 'admin@wedplan.com').toLowerCase()) {
      return res.status(403).json({
        success: false,
        error: 'Admin accounts must log in with email and password only. Google Sign-In is restricted for administrators.',
      });
    }

    let user = await User.findOne({ email: normalizedEmail });

    if (user) {
      if (user.role === 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Admin accounts must log in with email and password only. Google Sign-In is restricted for administrators.',
        });
      }
      if (user.isBlocked) {
        return res.status(403).json({ success: false, error: 'Your account has been blocked.' });
      }
      if (googleId && !user.googleId) user.googleId = googleId;
      if (image && !user.image) user.image = image;
      await user.save();
    } else {
      let selectedRole = role ? role.toLowerCase() : 'customer';
      if (!['customer', 'vendor'].includes(selectedRole)) selectedRole = 'customer';
      user = await User.create({
        name: name || 'Google User',
        email: normalizedEmail,
        image: image || '',
        role: selectedRole,
        googleId,
        subscriptionPlan: 'free',
        isBlocked: false,
      });
    }

    const token = generateToken(user);
    return res.status(200).json({
      success: true,
      message: 'Google authentication successful.',
      token,
      user: user.toSafeObject(),
      data: { user: user.toSafeObject(), token },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Google authentication failed.' });
  }
};

// Profile & Me
const getMeHandler = async (req, res) => {
  return res.status(200).json({
    success: true,
    user: req.user.toSafeObject(),
    data: { user: req.user.toSafeObject() },
  });
};

const updateProfileHandler = async (req, res) => {
  try {
    const { name, image, businessName } = req.body;
    const user = req.user;
    if (name) user.name = name.trim();
    if (image !== undefined) user.image = image;
    if (user.role === 'vendor' && businessName) user.businessName = businessName.trim();
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      user: user.toSafeObject(),
      data: { user: user.toSafeObject() },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to update profile.' });
  }
};

const changePasswordHandler = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'Current password and new password are required.' });
    }
    if (!validatePassword(newPassword)) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 6 characters with uppercase and lowercase letters.',
      });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (user.password) {
      const match = await user.comparePassword(currentPassword);
      if (!match) return res.status(400).json({ success: false, error: 'Current password is incorrect.' });
    }

    user.password = newPassword;
    await user.save();
    return res.status(200).json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to change password.' });
  }
};

// Mount Auth routes (Better Auth integration)
const { betterAuthMiddleware } = require('./auth');
apiRouter.all('/auth/sign-in/*', betterAuthMiddleware);
apiRouter.all('/auth/sign-up/*', betterAuthMiddleware);
apiRouter.all('/auth/callback/*', betterAuthMiddleware);
apiRouter.all('/auth/get-session', betterAuthMiddleware);
apiRouter.all('/auth/session', betterAuthMiddleware);
apiRouter.all('/auth/sign-out', betterAuthMiddleware);
apiRouter.all('/auth/social/*', betterAuthMiddleware);

apiRouter.post('/auth/register', registerHandler);
apiRouter.post('/auth/login', loginHandler);
apiRouter.post('/auth/google', googleAuthHandler);
apiRouter.get('/auth/me', authenticate, getMeHandler);
apiRouter.put('/auth/profile', authenticate, updateProfileHandler);
apiRouter.put('/auth/change-password', authenticate, changePasswordHandler);

// --- SERVICES APIS ---
// Get all services (browse, filter, sort, search)
const getAllServicesHandler = async (req, res) => {
  try {
    const { search, category, location, minPrice, maxPrice, sortBy = 'createdAt', sortOrder = 'desc', page = 1, limit = 12 } = req.query;

    const query = { status: 'approved', isActive: true };
    if (category && category !== 'All') query.category = category;
    if (location) query.location = { $regex: location.trim(), $options: 'i' };

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    if (search && search.trim()) {
      const regex = { $regex: search.trim(), $options: 'i' };
      query.$or = [{ serviceName: regex }, { description: regex }, { location: regex }, { category: regex }];
    }

    let sort = {};
    const order = sortOrder === 'asc' ? 1 : -1;
    if (sortBy === 'price') sort.price = order;
    else sort[sortBy] = order;

    const pageNum = Math.max(1, parseInt(page, 10));
    const pageSize = Math.max(1, parseInt(limit, 10));
    const skip = (pageNum - 1) * pageSize;

    const total = await Service.countDocuments(query);
    const services = await Service.find(query)
      .populate('vendorId', 'name email image businessName subscriptionPlan')
      .sort(sort)
      .skip(skip)
      .limit(pageSize);

    return res.status(200).json({
      success: true,
      total,
      totalPages: Math.ceil(total / pageSize),
      currentPage: pageNum,
      services,
      data: services,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve wedding services.' });
  }
};

// Featured services (at least 6 for homepage)
const getFeaturedServicesHandler = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 6;
    const services = await Service.find({ status: 'approved', isActive: true })
      .populate('vendorId', 'name email image businessName subscriptionPlan')
      .sort({ createdAt: -1 })
      .limit(limit);

    return res.status(200).json({ success: true, count: services.length, services });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve featured services.' });
  }
};

// Categories with active counts
const getCategoriesHandler = async (req, res) => {
  try {
    const categoryCounts = await Service.aggregate([
      { $match: { status: 'approved', isActive: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]);
    const countMap = {};
    categoryCounts.forEach((c) => {
      countMap[c._id] = c.count;
    });

    const categories = serviceCategories.map((name) => ({
      name,
      count: countMap[name] || 0,
    }));

    return res.status(200).json({ success: true, categories });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve categories.' });
  }
};

// Vendor my services
const getMyServicesHandler = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = { vendorId: req.user._id };
    if (status && ['pending', 'approved', 'rejected'].includes(status)) query.status = status;

    const pageNum = Math.max(1, parseInt(page, 10));
    const pageSize = Math.max(1, parseInt(limit, 10));
    const skip = (pageNum - 1) * pageSize;

    const total = await Service.countDocuments(query);
    const services = await Service.find(query).sort({ createdAt: -1 }).skip(skip).limit(pageSize);

    return res.status(200).json({
      success: true,
      total,
      totalPages: Math.ceil(total / pageSize),
      currentPage: pageNum,
      services,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve vendor services.' });
  }
};

// Service details by ID
const getServiceByIdHandler = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid service ID format.' });
    }

    const service = await Service.findById(id).populate('vendorId', 'name email image businessName subscriptionPlan isBlocked');
    if (!service) {
      return res.status(404).json({ success: false, error: 'Wedding service not found.' });
    }

    const isOwner = req.user && service.vendorId && service.vendorId._id.toString() === req.user._id.toString();
    const isAdmin = req.user && req.user.role === 'admin';

    if ((service.status !== 'approved' || !service.isActive) && !isOwner && !isAdmin) {
      return res.status(404).json({ success: false, error: 'This service is currently unavailable or pending review.' });
    }

    return res.status(200).json({ success: true, service, data: service });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve service details.' });
  }
};

// Create Service (enforces 3 active limit on free plan)
const createServiceHandler = async (req, res) => {
  try {
    const { serviceName, category, description, price, location, images } = req.body;
    if (!serviceName || !category || !description || price === undefined || !location) {
      return res.status(400).json({
        success: false,
        error: 'Please provide service name, category, description, price, and location.',
      });
    }

    const imagesArray = Array.isArray(images) ? images.filter(Boolean) : typeof images === 'string' && images ? [images] : [];
    if (imagesArray.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one service image is required.' });
    }

    const isPremium = req.user.subscriptionPlan === 'premium';
    if (!isPremium) {
      const activeCount = await Service.countDocuments({
        vendorId: req.user._id,
        status: { $ne: 'rejected' },
        isActive: true,
      });

      if (activeCount >= 3) {
        return res.status(403).json({
          success: false,
          error: 'Free plan limit reached (maximum 3 active services). Please upgrade to Premium to publish unlimited services.',
          upgradeRequired: true,
        });
      }
    }

    const newService = await Service.create({
      vendorId: req.user._id,
      serviceName: serviceName.trim(),
      category: category.trim(),
      description: description.trim(),
      price: Number(price),
      location: location.trim(),
      images: imagesArray,
      status: 'pending',
      isActive: true,
    });

    return res.status(201).json({
      success: true,
      message: 'Service submitted successfully and is pending administrator review.',
      service: newService,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to create service.' });
  }
};

// Update Service
const updateServiceHandler = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, error: 'Invalid service ID.' });

    const service = await Service.findById(id);
    if (!service) return res.status(404).json({ success: false, error: 'Service not found.' });

    const isOwner = service.vendorId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, error: 'Forbidden: You do not have permission to modify this service.' });
    }

    const { serviceName, category, description, price, location, images, isActive } = req.body;
    if (serviceName) service.serviceName = serviceName.trim();
    if (category) service.category = category.trim();
    if (description) service.description = description.trim();
    if (price !== undefined) service.price = Number(price);
    if (location) service.location = location.trim();
    if (Array.isArray(images) && images.length > 0) service.images = images;
    if (typeof isActive === 'boolean') service.isActive = isActive;

    if (isOwner && service.status === 'rejected') service.status = 'pending';
    await service.save();

    return res.status(200).json({ success: true, message: 'Service updated successfully.', service });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to update service.' });
  }
};

// Delete Service
const deleteServiceHandler = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, error: 'Invalid service ID.' });

    const service = await Service.findById(id);
    if (!service) return res.status(404).json({ success: false, error: 'Service not found.' });

    const isOwner = service.vendorId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, error: 'Forbidden: You do not have permission to delete this service.' });
    }

    await Service.findByIdAndDelete(id);
    return res.status(200).json({ success: true, message: 'Service deleted successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to delete service.' });
  }
};

// Toggle Availability
const toggleAvailabilityHandler = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, error: 'Invalid service ID.' });

    const service = await Service.findById(id);
    if (!service) return res.status(404).json({ success: false, error: 'Service not found.' });

    if (service.vendorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Forbidden: You can only toggle your own service.' });
    }

    service.isActive = !service.isActive;
    await service.save();

    return res.status(200).json({
      success: true,
      message: `Service is now ${service.isActive ? 'available' : 'hidden'}.`,
      isActive: service.isActive,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to toggle availability.' });
  }
};

// Mount Service routes
apiRouter.get('/services', getAllServicesHandler);
apiRouter.get('/services/featured', getFeaturedServicesHandler);
apiRouter.get('/services/categories', getCategoriesHandler);
apiRouter.get('/services/my-services', authenticate, requireVendor, getMyServicesHandler);
apiRouter.get('/services/vendor/my-services', authenticate, requireVendor, getMyServicesHandler);
apiRouter.get('/services/:id', optionalAuth, getServiceByIdHandler);
apiRouter.post('/services', authenticate, requireVendor, createServiceHandler);
apiRouter.put('/services/:id', authenticate, requireVendorOrAdmin, updateServiceHandler);
apiRouter.delete('/services/:id', authenticate, requireVendorOrAdmin, deleteServiceHandler);
apiRouter.patch('/services/:id/availability', authenticate, requireVendor, toggleAvailabilityHandler);

// --- BOOKINGS APIS ---
// Customer submit booking
const createBookingHandler = async (req, res) => {
  try {
    const { serviceId, eventDate, eventLocation, message } = req.body;
    if (!serviceId || !eventDate || !eventLocation) {
      return res.status(400).json({ success: false, error: 'Service ID, event date, and event location are required.' });
    }

    if (!mongoose.Types.ObjectId.isValid(serviceId)) {
      return res.status(400).json({ success: false, error: 'Invalid service ID format.' });
    }

    if (req.user.role !== 'customer') {
      return res.status(403).json({ success: false, error: 'Only customer accounts can submit booking requests.' });
    }

    const service = await Service.findById(serviceId);
    if (!service) return res.status(404).json({ success: false, error: 'Service not found.' });

    if (service.status !== 'approved' || !service.isActive) {
      return res.status(400).json({ success: false, error: 'This service is currently unavailable for booking.' });
    }

    if (service.vendorId.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, error: 'You cannot submit a booking request for your own service.' });
    }

    const parsedDate = new Date(eventDate);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ success: false, error: 'Invalid event date format.' });
    }

    const startOfDay = new Date(parsedDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(parsedDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const duplicate = await Booking.findOne({
      serviceId,
      eventDate: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ['pending', 'accepted'] },
    });

    if (duplicate) {
      return res.status(400).json({
        success: false,
        error: 'An active or accepted booking request already exists for this service on the selected date. Please choose a different date.',
      });
    }

    const newBooking = await Booking.create({
      serviceId,
      vendorId: service.vendorId,
      customerId: req.user._id,
      eventDate: parsedDate,
      eventLocation: eventLocation.trim(),
      message: (message || '').trim(),
      status: 'pending',
    });

    const populated = await Booking.findById(newBooking._id)
      .populate('serviceId', 'serviceName images category price location')
      .populate('vendorId', 'name email businessName image');

    return res.status(201).json({
      success: true,
      message: 'Booking request submitted successfully.',
      booking: populated,
    });
  } catch (err) {
    console.error('Create Booking Error:', err);
    return res.status(500).json({ success: false, error: 'Failed to submit booking request.' });
  }
};

// Customer bookings
const getCustomerBookingsHandler = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = { customerId: req.user._id };
    if (status && ['pending', 'accepted', 'rejected', 'cancelled'].includes(status)) query.status = status;

    const pageNum = Math.max(1, parseInt(page, 10));
    const pageSize = Math.max(1, parseInt(limit, 10));
    const skip = (pageNum - 1) * pageSize;

    const total = await Booking.countDocuments(query);
    const bookings = await Booking.find(query)
      .populate('serviceId', 'serviceName images category price location')
      .populate('vendorId', 'name email businessName image')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize);

    return res.status(200).json({
      success: true,
      total,
      totalPages: Math.ceil(total / pageSize),
      currentPage: pageNum,
      bookings,
      data: bookings,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve your booking requests.' });
  }
};

// Customer cancel pending booking
const cancelBookingHandler = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, error: 'Invalid booking ID.' });

    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ success: false, error: 'Booking request not found.' });

    if (booking.customerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Forbidden: You cannot cancel another customer booking.' });
    }

    if (booking.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `Cannot cancel a booking that is already ${booking.status}. Only pending requests can be cancelled.`,
      });
    }

    booking.status = 'cancelled';
    await booking.save();

    return res.status(200).json({ success: true, message: 'Booking request cancelled successfully.', booking });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to cancel booking request.' });
  }
};

// Vendor booking requests
const getVendorBookingsHandler = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = { vendorId: req.user._id };
    if (status && ['pending', 'accepted', 'rejected', 'cancelled'].includes(status)) query.status = status;

    const pageNum = Math.max(1, parseInt(page, 10));
    const pageSize = Math.max(1, parseInt(limit, 10));
    const skip = (pageNum - 1) * pageSize;

    const total = await Booking.countDocuments(query);
    const bookings = await Booking.find(query)
      .populate('serviceId', 'serviceName images category price location')
      .populate('customerId', 'name email image')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize);

    return res.status(200).json({
      success: true,
      total,
      totalPages: Math.ceil(total / pageSize),
      currentPage: pageNum,
      bookings,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve vendor booking requests.' });
  }
};

// Vendor accept/reject
const updateBookingStatusHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, error: 'Invalid booking ID.' });
    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Status can only be updated to "accepted" or "rejected".' });
    }

    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ success: false, error: 'Booking request not found.' });

    if (booking.vendorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Forbidden: You can only respond to requests for your services.' });
    }

    if (booking.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `This request is already marked as "${booking.status}" and cannot be processed again.`,
      });
    }

    booking.status = status;
    await booking.save();

    return res.status(200).json({ success: true, message: `Booking request has been ${status}.`, booking });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to update booking status.' });
  }
};

// Single booking details
const getBookingByIdHandler = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, error: 'Invalid booking ID.' });

    const booking = await Booking.findById(id)
      .populate('serviceId')
      .populate('vendorId', 'name email businessName image')
      .populate('customerId', 'name email image');

    if (!booking) return res.status(404).json({ success: false, error: 'Booking request not found.' });

    const isCustomer = booking.customerId._id.toString() === req.user._id.toString();
    const isVendor = booking.vendorId._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isCustomer && !isVendor && !isAdmin) {
      return res.status(403).json({ success: false, error: 'Forbidden: Access denied to this booking request.' });
    }

    return res.status(200).json({ success: true, booking });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve booking details.' });
  }
};

// Mount Booking routes
apiRouter.post('/bookings', authenticate, requireCustomer, createBookingHandler);
apiRouter.get('/bookings/my-bookings', authenticate, requireCustomer, getCustomerBookingsHandler);
apiRouter.patch('/bookings/:id/cancel', authenticate, requireCustomer, cancelBookingHandler);
apiRouter.put('/bookings/:id/cancel', authenticate, requireCustomer, cancelBookingHandler);
apiRouter.get('/bookings/vendor-requests', authenticate, requireVendor, getVendorBookingsHandler);
apiRouter.patch('/bookings/:id/status', authenticate, requireVendor, updateBookingStatusHandler);
apiRouter.put('/bookings/:id/status', authenticate, requireVendor, updateBookingStatusHandler);
apiRouter.patch('/bookings/:id/respond', authenticate, requireVendor, updateBookingStatusHandler);
apiRouter.put('/bookings/:id/respond', authenticate, requireVendor, updateBookingStatusHandler);
apiRouter.get('/bookings/:id', authenticate, getBookingByIdHandler);

// --- PAYMENTS & STRIPE APIS ---
const createCheckoutSessionHandler = async (req, res) => {
  try {
    const vendor = req.user;
    if (vendor.role !== 'vendor') {
      return res.status(403).json({ success: false, error: 'Only vendor accounts can upgrade to Premium.' });
    }
    if (vendor.subscriptionPlan === 'premium') {
      return res.status(400).json({ success: false, error: 'Your account is already subscribed to Premium.' });
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
              description: 'Publish unlimited active wedding services, verified badge, and priority placement.',
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
      metadata: { vendorId: vendor._id.toString(), plan: 'premium' },
    });

    return res.status(200).json({
      success: true,
      url: session.url,
      sessionId: session.id,
      data: { url: session.url, sessionId: session.id },
    });
  } catch (err) {
    console.error('Create Checkout Session Error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to initialize payment session.' });
  }
};

const handleStripeWebhookHandler = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    if (config.stripe.webhookSecret && sig) {
      event = stripe.webhooks.constructEvent(req.rawBody || req.body, sig, config.stripe.webhookSecret);
    } else {
      event = req.body;
    }
  } catch (err) {
    console.error(`Webhook Signature Verification Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event && event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const vendorId = session.metadata ? session.metadata.vendorId : null;
    const plan = session.metadata ? session.metadata.plan : 'premium';

    if (vendorId) {
      try {
        const existingTx = await Transaction.findOne({ stripeSessionId: session.id });
        if (!existingTx) {
          const amountInDollars = session.amount_total ? session.amount_total / 100 : 49;
          await Transaction.create({
            vendorId,
            plan: plan || 'premium',
            amount: amountInDollars,
            currency: session.currency || 'usd',
            stripeSessionId: session.id,
            stripeSubscriptionId: session.subscription || null,
            status: 'succeeded',
          });

          const oneYear = new Date();
          oneYear.setFullYear(oneYear.getFullYear() + 1);
          await User.findByIdAndUpdate(vendorId, {
            subscriptionPlan: 'premium',
            subscriptionExpiresAt: oneYear,
          });
          console.log(`Vendor ${vendorId} successfully upgraded to Premium via Webhook!`);
        }
      } catch (dbErr) {
        console.error('Webhook Database Update Error:', dbErr);
        return res.status(500).json({ error: 'Database processing error' });
      }
    }
  }

  return res.status(200).json({ received: true });
};

const verifySessionHandler = async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) return res.status(400).json({ success: false, error: 'Session ID is required.' });

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (!session) return res.status(404).json({ success: false, error: 'Checkout session not found on Stripe.' });

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

        const oneYear = new Date();
        oneYear.setFullYear(oneYear.getFullYear() + 1);
        await User.findByIdAndUpdate(vendorId, {
          subscriptionPlan: 'premium',
          subscriptionExpiresAt: oneYear,
        });
      }
      return res.status(200).json({ success: true, paymentStatus: 'paid', transaction: tx });
    }

    return res.status(200).json({ success: true, paymentStatus: session.payment_status });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to verify payment session.' });
  }
};

const getMyTransactionsHandler = async (req, res) => {
  try {
    const transactions = await Transaction.find({ vendorId: req.user._id }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, transactions });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve transactions.' });
  }
};

// Mount Payment routes
apiRouter.post('/payments/create-checkout-session', authenticate, requireVendor, createCheckoutSessionHandler);
apiRouter.post('/payments/webhook', handleStripeWebhookHandler);
apiRouter.get('/payments/verify-session/:sessionId', authenticate, verifySessionHandler);
apiRouter.get('/payments/my-transactions', authenticate, requireVendor, getMyTransactionsHandler);

// --- DASHBOARD OVERVIEW APIS ---
const getVendorOverviewHandler = async (req, res) => {
  try {
    const vendorId = req.user._id;
    const [totalServices, activeServices, pendingBookings, acceptedBookings, rejectedBookings, recentBookings] =
      await Promise.all([
        Service.countDocuments({ vendorId }),
        Service.countDocuments({ vendorId, isActive: true, status: 'approved' }),
        Booking.countDocuments({ vendorId, status: 'pending' }),
        Booking.countDocuments({ vendorId, status: 'accepted' }),
        Booking.countDocuments({ vendorId, status: 'rejected' }),
        Booking.find({ vendorId })
          .populate('serviceId', 'serviceName images price')
          .populate('customerId', 'name email image')
          .sort({ createdAt: -1 })
          .limit(5),
      ]);

    const isPremium = req.user.subscriptionPlan === 'premium';
    return res.status(200).json({
      success: true,
      stats: {
        totalServices,
        activeServices,
        pendingBookings,
        acceptedBookings,
        rejectedBookings,
        subscriptionPlan: req.user.subscriptionPlan || 'free',
        subscriptionExpiresAt: req.user.subscriptionExpiresAt,
        maxActiveServices: isPremium ? 'Unlimited' : 3,
        canAddService: isPremium || activeServices < 3,
      },
      recentBookings,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve vendor dashboard statistics.' });
  }
};

const getCustomerOverviewHandler = async (req, res) => {
  try {
    const customerId = req.user._id;
    const [totalBookings, pendingBookings, acceptedBookings, rejectedBookings, cancelledBookings, recentBookings] =
      await Promise.all([
        Booking.countDocuments({ customerId }),
        Booking.countDocuments({ customerId, status: 'pending' }),
        Booking.countDocuments({ customerId, status: 'accepted' }),
        Booking.countDocuments({ customerId, status: 'rejected' }),
        Booking.countDocuments({ customerId, status: 'cancelled' }),
        Booking.find({ customerId })
          .populate('serviceId', 'serviceName images category price location')
          .populate('vendorId', 'name email businessName image')
          .sort({ createdAt: -1 })
          .limit(5),
      ]);

    return res.status(200).json({
      success: true,
      stats: { totalBookings, pendingBookings, acceptedBookings, rejectedBookings, cancelledBookings },
      recentBookings,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve customer dashboard statistics.' });
  }
};

// Mount Dashboard routes
apiRouter.get('/vendor/overview', authenticate, requireVendor, getVendorOverviewHandler);
apiRouter.get('/customer/overview', authenticate, requireCustomer, getCustomerOverviewHandler);
apiRouter.get('/dashboard/vendor', authenticate, requireVendor, getVendorOverviewHandler);
apiRouter.get('/dashboard/customer', authenticate, requireCustomer, getCustomerOverviewHandler);

// --- ADMIN GOVERNANCE APIS ---
const getAdminOverviewHandler = async (req, res) => {
  try {
    const [
      totalUsers,
      totalVendors,
      totalCustomers,
      totalServices,
      pendingServices,
      approvedServices,
      totalBookings,
      totalTransactions,
      revenueResult,
      recentTransactions,
      recentUsers,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'vendor' }),
      User.countDocuments({ role: 'customer' }),
      Service.countDocuments(),
      Service.countDocuments({ status: 'pending' }),
      Service.countDocuments({ status: 'approved' }),
      Booking.countDocuments(),
      Transaction.countDocuments(),
      Transaction.aggregate([
        { $match: { status: 'succeeded' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Transaction.find().populate('vendorId', 'name email businessName image').sort({ createdAt: -1 }).limit(5),
      User.find().sort({ createdAt: -1 }).limit(5).select('-password'),
    ]);

    const totalRevenue = revenueResult.length > 0 && revenueResult[0].total ? Number(revenueResult[0].total.toFixed(2)) : 0;

    return res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        totalVendors,
        totalCustomers,
        totalServices,
        pendingServices,
        approvedServices,
        totalBookings,
        totalTransactions,
        totalRevenue,
      },
      recentTransactions,
      recentUsers,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve admin dashboard overview.' });
  }
};

const getAllUsersHandler = async (req, res) => {
  try {
    const { search, role, isBlocked, page = 1, limit = 20 } = req.query;
    const query = {};
    if (role && ['customer', 'vendor', 'admin'].includes(role)) query.role = role;
    if (isBlocked !== undefined && isBlocked !== '') query.isBlocked = isBlocked === 'true';
    if (search && search.trim()) {
      const regex = { $regex: search.trim(), $options: 'i' };
      query.$or = [{ name: regex }, { email: regex }, { businessName: regex }];
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const pageSize = Math.max(1, parseInt(limit, 10));
    const skip = (pageNum - 1) * pageSize;

    const total = await User.countDocuments(query);
    const users = await User.find(query).select('-password').sort({ createdAt: -1 }).skip(skip).limit(pageSize);

    return res.status(200).json({ success: true, total, totalPages: Math.ceil(total / pageSize), currentPage: pageNum, users });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve registered users.' });
  }
};

const getUserByIdHandler = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, error: 'Invalid user ID.' });

    const user = await User.findById(id).select('-password');
    if (!user) return res.status(404).json({ success: false, error: 'User not found.' });

    let services = [];
    let bookings = [];
    if (user.role === 'vendor') services = await Service.find({ vendorId: id }).sort({ createdAt: -1 });
    else if (user.role === 'customer') {
      bookings = await Booking.find({ customerId: id }).populate('serviceId', 'serviceName images price').sort({ createdAt: -1 });
    }

    return res.status(200).json({ success: true, user, services, bookings });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve user details.' });
  }
};

const toggleBlockUserHandler = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, error: 'Invalid user ID.' });

    const targetUser = await User.findById(id);
    if (!targetUser) return res.status(404).json({ success: false, error: 'User not found.' });

    if (targetUser.role === 'admin') {
      return res.status(403).json({ success: false, error: 'Administrator accounts cannot be blocked.' });
    }

    targetUser.isBlocked = !targetUser.isBlocked;
    await targetUser.save();

    return res.status(200).json({
      success: true,
      message: `User has been successfully ${targetUser.isBlocked ? 'blocked' : 'unblocked'}.`,
      user: targetUser.toSafeObject(),
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to toggle user block status.' });
  }
};

const getAllServicesAdminHandler = async (req, res) => {
  try {
    const { status, category, search, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status && ['pending', 'approved', 'rejected'].includes(status)) query.status = status;
    if (category && category !== 'All') query.category = category;
    if (search && search.trim()) {
      const regex = { $regex: search.trim(), $options: 'i' };
      query.$or = [{ serviceName: regex }, { location: regex }, { description: regex }];
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const pageSize = Math.max(1, parseInt(limit, 10));
    const skip = (pageNum - 1) * pageSize;

    const total = await Service.countDocuments(query);
    const services = await Service.find(query)
      .populate('vendorId', 'name email businessName image subscriptionPlan')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize);

    return res.status(200).json({ success: true, total, totalPages: Math.ceil(total / pageSize), currentPage: pageNum, services });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve services.' });
  }
};

const updateServiceStatusHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, error: 'Invalid service ID.' });
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Status must be "approved", "rejected", or "pending".' });
    }

    const service = await Service.findById(id).populate('vendorId', 'name email businessName');
    if (!service) return res.status(404).json({ success: false, error: 'Service not found.' });

    service.status = status;
    await service.save();

    return res.status(200).json({ success: true, message: `Service status updated to "${status}".`, service });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to update service status.' });
  }
};

const deleteServiceAdminHandler = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, error: 'Invalid service ID.' });

    const service = await Service.findByIdAndDelete(id);
    if (!service) return res.status(404).json({ success: false, error: 'Service not found.' });

    return res.status(200).json({ success: true, message: 'Service deleted permanently by administrator.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to delete service.' });
  }
};

const getAllTransactionsHandler = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const query = {};
    if (status && ['succeeded', 'pending', 'failed'].includes(status)) query.status = status;

    const pageNum = Math.max(1, parseInt(page, 10));
    const pageSize = Math.max(1, parseInt(limit, 10));
    const skip = (pageNum - 1) * pageSize;

    const total = await Transaction.countDocuments(query);
    const transactions = await Transaction.find(query)
      .populate('vendorId', 'name email businessName image')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize);

    return res.status(200).json({ success: true, total, totalPages: Math.ceil(total / pageSize), currentPage: pageNum, transactions });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve transactions.' });
  }
};

// Mount Admin routes
apiRouter.get('/admin/overview', authenticate, requireAdmin, getAdminOverviewHandler);
apiRouter.get('/admin/users', authenticate, requireAdmin, getAllUsersHandler);
apiRouter.get('/admin/users/:id', authenticate, requireAdmin, getUserByIdHandler);
apiRouter.patch('/admin/users/:id/block', authenticate, requireAdmin, toggleBlockUserHandler);
apiRouter.put('/admin/users/:id/block', authenticate, requireAdmin, toggleBlockUserHandler);
apiRouter.get('/admin/services', authenticate, requireAdmin, getAllServicesAdminHandler);
apiRouter.patch('/admin/services/:id/status', authenticate, requireAdmin, updateServiceStatusHandler);
apiRouter.put('/admin/services/:id/status', authenticate, requireAdmin, updateServiceStatusHandler);
apiRouter.delete('/admin/services/:id', authenticate, requireAdmin, deleteServiceAdminHandler);
apiRouter.get('/admin/transactions', authenticate, requireAdmin, getAllTransactionsHandler);

// --- UPLOAD API ---
const uploadHandler = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No image file uploaded.' });

    const apiKey = config.imgbb.apiKey;
    if (apiKey) {
      const base64Image = req.file.buffer.toString('base64');
      const formData = new URLSearchParams();
      formData.append('image', base64Image);

      const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (data && data.success) {
        return res.status(200).json({
          success: true,
          url: data.data.url,
          displayUrl: data.data.display_url,
          deleteUrl: data.data.delete_url,
        });
      }
    }

    const ext = path.extname(req.file.originalname) || '.jpg';
    const filename = `img_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`;
    const filePath = path.join(uploadsDir, filename);
    fs.writeFileSync(filePath, req.file.buffer);

    const protocol = req.protocol;
    const host = req.get('host');
    const localUrl = `${protocol}://${host}/uploads/${filename}`;

    return res.status(200).json({ success: true, url: localUrl, filename });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to process image upload.' });
  }
};

apiRouter.post('/upload', authenticate, upload.single('image'), uploadHandler);

// Ensure DB connection for serverless environments (Vercel)
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('Database connection error in request:', err);
    next();
  }
});

// Mount router on BOTH '/api' AND root '/' for seamless client compatibility!
app.use('/api', apiRouter);
app.use('/', apiRouter);

// --- 404 & GLOBAL ERROR HANDLER ---
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Resource not found - ${req.originalUrl}` });
});

app.use((err, req, res, next) => {
  console.error('Unhandled Application Error:', err);
  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  if (err.name === 'CastError') {
    return res.status(400).json({ success: false, error: `Invalid format for ID: ${err.value}` });
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(409).json({ success: false, error: `A record with this ${field} already exists.` });
  }
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((v) => v.message);
    return res.status(400).json({ success: false, error: messages.join(', ') });
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(config.env === 'development' && { stack: err.stack }),
  });
});

// ==========================================
// 8. SERVER STARTUP & EXPORTS
// ==========================================
const PORT = config.port;

const startServer = async () => {
  try {
    await connectDB();
    await seedDatabase();

    const server = app.listen(PORT, () => {
      console.log(`WedPlan API Server running in ${config.env} mode on port ${PORT}`);
      console.log(`Ready to accept connections from: ${config.clientUrl}`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Error: Port ${PORT} is already in use by another process.`);
      } else {
        console.error('Server listen error:', err);
      }
      process.exit(1);
    });

    const gracefulShutdown = async () => {
      server.close(async () => {
        await disconnectDB();
        process.exit(0);
      });
    };

    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

if (!process.env.VERCEL && require.main === module) {
  startServer();
}

// Attach helpers to app for backward compatibility with testing suites
app.app = app;
app.startServer = startServer;
app.connectDB = connectDB;
app.disconnectDB = disconnectDB;
app.seedDatabase = seedDatabase;
app.User = User;
app.Service = Service;
app.Booking = Booking;
app.Transaction = Transaction;
app.generateToken = generateToken;
app.verifyToken = verifyToken;

// Default export MUST be the Express app function for Vercel Serverless
module.exports = app;
