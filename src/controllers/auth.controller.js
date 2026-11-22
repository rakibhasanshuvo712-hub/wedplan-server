const { User } = require('../models');
const { generateToken } = require('../utils/jwt');

// Verify a Google Identity Services token directly with Google. Only the public
// Client ID is required, so no secret is ever needed in the browser.
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';

// Accept every common credential field name so a valid sign-in is never rejected
// simply because of the name the client used for the token.
const extractIdentityToken = (req) => {
  const body = req.body || {};
  const candidates = [
    body.accessToken,
    body.idToken,
    body.credential,
    body.googleToken,
    body.token,
    body.access_token,
    body.id_token,
    body.credentialResponse?.credential,
    body.response?.credential,
  ];

  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (authHeader && /^Bearer\s+/i.test(authHeader)) {
    candidates.push(authHeader.replace(/^Bearer\s+/i, ''));
  }

  return candidates.find((value) => typeof value === 'string' && value.trim())?.trim() || null;
};

const isExplicitlyUnverified = (value) =>
  value === false || value === 'false' || value === 0 || value === '0';

const toGoogleProfile = (data) => {
  if (!data) return null;

  const subject = data.sub || data.user_id || data.id;
  const email = data.email || data.verified_email;
  if (!subject || !email) return null;
  if (isExplicitlyUnverified(data.email_verified)) return null;

  return {
    googleId: String(subject),
    email: String(email).toLowerCase().trim(),
    name: data.name || data.given_name || '',
    image: data.picture || data.picture_url || data.image || '',
  };
};

const verifyGoogleIdentity = async (token) => {
  if (!token || typeof token !== 'string') return null;
  const identityToken = token.trim();
  if (!identityToken) return null;

  try {
    if (identityToken.startsWith('ya29.')) {
      let response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${identityToken}` },
      });
      if (!response.ok) {
        response = await fetch(
          `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(identityToken)}`
        );
        if (!response.ok) return null;
      }
      return toGoogleProfile(await response.json());
    }

    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(identityToken)}`
    );
    if (!response.ok) return null;
    const data = await response.json();
    if (GOOGLE_CLIENT_ID && data.aud && data.aud !== GOOGLE_CLIENT_ID) return null;
    return toGoogleProfile(data);
  } catch (error) {
    console.warn('Google identity verification failed:', error.message);
    return null;
  }
};

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
      token,
      user: newUser.toSafeObject(),
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
      token,
      user: user.toSafeObject(),
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
    const identityToken = extractIdentityToken(req);
    const profile = await verifyGoogleIdentity(identityToken);

    if (!profile) {
      return res.status(401).json({
        success: false,
        error: 'Google sign-in could not be verified. Please retry with your Google account.',
      });
    }

    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@wedplan.com').toLowerCase();
    if (profile.email === adminEmail) {
      return res.status(403).json({
        success: false,
        error: 'Administrator accounts must log in with email and password only.',
      });
    }

    let user = await User.findOne({ email: profile.email });

    if (user) {
      if (user.role === 'admin' || user.isBlocked) {
        return res.status(403).json({
          success: false,
          error:
            user.role === 'admin'
              ? 'Administrator accounts must log in with email and password only.'
              : 'Your account has been blocked. Access is restricted.',
        });
      }
      if (!user.googleId) user.googleId = profile.googleId;
      if (!user.image && profile.image) user.image = profile.image;
      // Explicit vendor Google sign-up upgrades an existing customer account.
      const requestedRole = String(req.body?.role || '').toLowerCase();
      if (requestedRole === 'vendor' && user.role === 'customer') {
        user.role = 'vendor';
        user.businessName = user.businessName || profile.name || '';
      }
      await user.save();
    } else {
      const requestedRole = String(req.body?.role || '').toLowerCase();
      const assignedRole = ['customer', 'vendor'].includes(requestedRole) ? requestedRole : 'customer';

      user = new User({
        name: profile.name || profile.email.split('@')[0],
        email: profile.email,
        image: profile.image || '',
        role: assignedRole,
        businessName: assignedRole === 'vendor' ? profile.name : '',
        googleId: profile.googleId,
        subscriptionPlan: 'free',
        isBlocked: false,
      });
      await user.save();
    }

    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: 'Google authentication successful.',
      token,
      user: user.toSafeObject(),
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
    user: req.user.toSafeObject(),
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
      user: user.toSafeObject(),
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
