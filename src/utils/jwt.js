const jwt = require('jsonwebtoken');
const config = require('../config');

const generateToken = (user) => {
  const payload = {
    id: user._id,
    email: user.email,
    role: user.role,
    name: user.name,
  };

  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.secret);
  } catch (error) {
    return null;
  }
};

module.exports = {
  generateToken,
  verifyToken,
};
