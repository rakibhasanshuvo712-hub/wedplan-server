const User = require('./user.model');
const { Service, serviceCategories } = require('./service.model');
const Booking = require('./booking.model');
const Transaction = require('./transaction.model');

module.exports = {
  User,
  Service,
  serviceCategories,
  Booking,
  Transaction,
};
