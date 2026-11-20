const { User } = require('../models');
const { generateToken } = require('../utils/jwt');

// Helper for password validation: min 6 chars, 1 uppercase, 1 lowercase
const validatePassword = (password) => {
  if (!password || typeof password !== 'string') return false;
  if (password.length < 6) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  return true;
};

/**
 * Register a new User (Customer or Vendor)
 */
const register = async (req, res) => {
  try {
    const { name, email, password, image, role, businessName } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Full name, email, and password are required.',
      });
    }

    // Role verification: only 'customer' or 'vendor' allowed through registration
    const selectedRole = role ? role.toLowerCase() : 'customer';
    if (!['customer', 'vendor'].includes(selectedRole)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid account role. Must be either "customer" or "vendor". Admin accounts cannot be created publicly.',
      });
    }

    // Password validation rule
    if (!validatePassword(password)) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long and contain at least one uppercase letter and one lowercase letter.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'An account with this email address already exists.',
      });
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
      message: 'Account registered successfully.',
      token,
      user: newUser.toSafeObject(),
    });
  } catch (error) {
    console.error('Registration Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Registration failed. Please try again.',
    });
  }
};

/**
 * Sign In with Email & Password
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

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.',
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.',
      });
    }

    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        error: 'Your account has been blocked. Please contact support.',
      });
    }

    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: 'Signed in successfully.',
      token,
      user: user.toSafeObject(),
    });
  } catch (error) {
    console.error('Login Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Login failed. Please try again.',
    });
  }
};

/**
 * Google Authentication / OAuth sync
 */
const googleAuth = async (req, res) => {
  try {
    const { email, name, image, googleId, role } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required for Google authentication.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    let user = await User.findOne({ email: normalizedEmail });

    if (user) {
      if (user.isBlocked) {
        return res.status(403).json({
          success: false,
          error: 'Your account has been blocked. Please contact support.',
        });
      }

      // Update googleId or image if not present
      if (googleId && !user.googleId) user.googleId = googleId;
      if (image && !user.image) user.image = image;
      await user.save();
    } else {
      // Determine role for new user (default to customer if not specified or admin)
      let selectedRole = role ? role.toLowerCase() : 'customer';
      if (!['customer', 'vendor'].includes(selectedRole)) {
        selectedRole = 'customer';
      }

      user = await User.create({
        name: name || 'Google User',
        email: normalizedEmail,
        image: image || '',
        role: selectedRole,
        googleId: googleId || '',
        isBlocked: false,
        subscriptionPlan: 'free',
      });
    }

    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: 'Google authentication successful.',
      token,
      user: user.toSafeObject(),
    });
  } catch (error) {
    console.error('Google Auth Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Google authentication failed.',
    });
  }
};

/**
 * Get current authenticated user profile
 */
const getMe = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      user: req.user.toSafeObject(),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve user profile.',
    });
  }
};

/**
 * Update Profile Information (Customers & Vendors)
 * Strict rules: Users must not be able to change role or subscription status.
 */
const updateProfile = async (req, res) => {
  try {
    const { name, image, businessName } = req.body;
    const user = req.user;

    if (name) user.name = name.trim();
    if (typeof image === 'string') user.image = image.trim();
    if (user.role === 'vendor' && typeof businessName === 'string') {
      user.businessName = businessName.trim();
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      user: user.toSafeObject(),
    });
  } catch (error) {
    console.error('Update Profile Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update profile.',
    });
  }
};

/**
 * Change Password
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password and new password are required.',
      });
    }

    if (!validatePassword(newPassword)) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 6 characters long and contain at least one uppercase letter and one lowercase letter.',
      });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    // If user has existing password, verify it
    if (user.password) {
      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) {
        return res.status(400).json({
          success: false,
          error: 'Current password does not match.',
        });
      }
    }

    user.password = newPassword;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully.',
    });
  } catch (error) {
    console.error('Change Password Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to change password.',
    });
  }
};

module.exports = {
  register,
  login,
  googleAuth,
  getMe,
  updateProfile,
  changePassword,
};
