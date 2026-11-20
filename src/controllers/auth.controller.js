const { User } = require('../models');
const { generateToken } = require('../utils/jwt');

/**
 * Register a new customer or vendor
 * POST /api/auth/register
 */
const register = async (req, res) => {
  try {
    const { name, email, password, image, role, businessName } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Name, email, and password are required.',
      });
    }

    // Role validation: public registration only permits 'customer' or 'vendor'
    const allowedRoles = ['customer', 'vendor'];
    const assignedRole = allowedRoles.includes(role) ? role : 'customer';

    if (role === 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin accounts cannot be created through public registration.',
      });
    }

    // Password strength rules: min 6 chars, 1 uppercase, 1 lowercase
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long.',
      });
    }

    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);

    if (!hasUppercase || !hasLowercase) {
      return res.status(400).json({
        success: false,
        error: 'Password must contain at least one uppercase and one lowercase letter.',
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'An account with this email address already exists.',
      });
    }

    // Create user
    const newUser = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      image: image || '',
      role: assignedRole,
      businessName: assignedRole === 'vendor' ? (businessName || name).trim() : '',
      subscriptionPlan: 'free',
      isBlocked: false,
    });

    await newUser.save();

    const token = generateToken(newUser);

    return res.status(201).json({
      success: true,
      message: 'Registration successful! Welcome to WedPlan.',
      data: {
        user: newUser.toSafeObject(),
        token,
      },
    });
  } catch (error) {
    console.error('Registration Error:', error);
    return res.status(500).json({
      success: false,
      error: 'An error occurred during registration. Please try again.',
    });
  }
};

/**
 * Log in with email and password
 * POST /api/auth/login
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required.',
      });
    }

    // Explicitly select password field to verify
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password credentials.',
      });
    }

    // Blocked check
    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        error: 'Your account has been blocked by administrators. Access is prohibited.',
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password credentials.',
      });
    }

    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: 'Logged in successfully.',
      data: {
        user: user.toSafeObject(),
        token,
      },
    });
  } catch (error) {
    console.error('Login Error:', error);
    return res.status(500).json({
      success: false,
      error: 'An error occurred during login. Please try again.',
    });
  }
};

/**
 * Social / Google authentication
 * POST /api/auth/google
 */
const googleAuth = async (req, res) => {
  try {
    const { email, name, image, role, googleId } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Google email is required.',
      });
    }

    let user = await User.findOne({ email: email.toLowerCase().trim() });

    if (user) {
      if (user.isBlocked) {
        return res.status(403).json({
          success: false,
          error: 'Your account has been blocked. Access is restricted.',
        });
      }

      if (!user.googleId && googleId) {
        user.googleId = googleId;
        if (!user.image && image) user.image = image;
        await user.save();
      }
    } else {
      const allowedRoles = ['customer', 'vendor'];
      const assignedRole = allowedRoles.includes(role) ? role : 'customer';

      user = new User({
        name: name || email.split('@')[0],
        email: email.toLowerCase().trim(),
        image: image || '',
        role: assignedRole,
        businessName: assignedRole === 'vendor' ? name : '',
        googleId,
        subscriptionPlan: 'free',
        isBlocked: false,
      });

      await user.save();
    }

    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: 'Google authentication successful.',
      data: {
        user: user.toSafeObject(),
        token,
      },
    });
  } catch (error) {
    console.error('Google Auth Error:', error);
    return res.status(500).json({
      success: false,
      error: 'An error occurred with Google authentication.',
    });
  }
};

/**
 * Get current user profile
 * GET /api/auth/me
 */
const getMe = async (req, res) => {
  return res.status(200).json({
    success: true,
    data: {
      user: req.user.toSafeObject(),
    },
  });
};

/**
 * Update user profile
 * PUT /api/auth/profile
 */
const updateProfile = async (req, res) => {
  try {
    const { name, image, businessName } = req.body;
    const user = req.user;

    if (name) user.name = name.trim();
    if (image !== undefined) user.image = image;
    if (user.role === 'vendor' && businessName) {
      user.businessName = businessName.trim();
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      data: {
        user: user.toSafeObject(),
      },
    });
  } catch (error) {
    console.error('Update Profile Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update profile.',
    });
  }
};

module.exports = {
  register,
  login,
  googleAuth,
  getMe,
  updateProfile,
};
