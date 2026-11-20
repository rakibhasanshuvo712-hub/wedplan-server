const User = require('./user.model');
const { Service, serviceCategories } = require('./service.model');
const Booking = require('./booking.model');
const Transaction = require('./transaction.model');
const Vendor = require('./vendor.model');
const Customer = require('./customer.model');
const Payment = require('./payment.model');

module.exports = {
  User,
  Service,
  serviceCategories,
  Booking,
  Transaction,
  Vendor,
  Customer,
  Payment,
};
