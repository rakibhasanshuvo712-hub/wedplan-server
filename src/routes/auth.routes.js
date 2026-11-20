const { Router } = require('express');
const {
  register,
  login,
  googleAuth,
  getMe,
  updateProfile,
  changePassword,
} = require('../controllers/auth.controller');
const { authenticate } = require('../middleware');

const router = Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/google', googleAuth);

// Authenticated routes
router.get('/me', authenticate, getMe);
router.put('/profile', authenticate, updateProfile);
router.put('/change-password', authenticate, changePassword);

module.exports = router;
