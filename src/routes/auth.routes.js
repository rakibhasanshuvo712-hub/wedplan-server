const { Router } = require('express');
const {
  register,
  login,
  googleAuth,
  getMe,
  updateProfile,
} = require('../controllers/auth.controller');
const { authenticate } = require('../middleware');

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/google', googleAuth);
router.get('/me', authenticate, getMe);
router.put('/profile', authenticate, updateProfile);

module.exports = router;
