const { Service, Booking } = require('../models');

/**
 * Vendor: Dashboard Overview Statistics
 * Shows: Total Services, Active Services, Pending Booking Requests, Accepted Bookings, Current Subscription Plan
 */
const getVendorOverview = async (req, res) => {
  try {
    const vendorId = req.user._id;

    const [
      totalServices,
      activeServices,
      pendingBookings,
      acceptedBookings,
      rejectedBookings,
      recentBookings,
    ] = await Promise.all([
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
  } catch (error) {
    console.error('Vendor Overview Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve vendor dashboard statistics.',
    });
  }
};

/**
 * Customer: Dashboard Overview Statistics
 * Shows: Total Booking Requests, Pending Bookings, Accepted Bookings, Rejected Bookings
 */
const getCustomerOverview = async (req, res) => {
  try {
    const customerId = req.user._id;

    const [
      totalBookings,
      pendingBookings,
      acceptedBookings,
      rejectedBookings,
      cancelledBookings,
      recentBookings,
    ] = await Promise.all([
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
      stats: {
        totalBookings,
        pendingBookings,
        acceptedBookings,
        rejectedBookings,
        cancelledBookings,
      },
      recentBookings,
    });
  } catch (error) {
    console.error('Customer Overview Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve customer dashboard statistics.',
    });
  }
};

module.exports = {
  getVendorOverview,
  getCustomerOverview,
};
