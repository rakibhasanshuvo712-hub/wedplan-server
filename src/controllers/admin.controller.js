const mongoose = require('mongoose');
const { User, Service, Booking, Transaction } = require('../models');

/**
 * Admin: Dashboard Overview Statistics
 */
const getAdminOverview = async (req, res) => {
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
      Transaction.find()
        .populate('vendorId', 'name email businessName image')
        .sort({ createdAt: -1 })
        .limit(5),
      User.find().sort({ createdAt: -1 }).limit(5).select('-password'),
    ]);

    const totalRevenue =
      revenueResult.length > 0 && revenueResult[0].total
        ? Number(revenueResult[0].total.toFixed(2))
        : 0;

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
  } catch (error) {
    console.error('Admin Overview Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve admin dashboard overview.',
    });
  }
};

/**
 * Admin: Get All Registered Users with Search and Filter
 */
const getAllUsers = async (req, res) => {
  try {
    const { search, role, isBlocked, page = 1, limit = 20 } = req.query;

    const query = {};

    if (role && ['customer', 'vendor', 'admin'].includes(role)) {
      query.role = role;
    }

    if (isBlocked !== undefined && isBlocked !== '') {
      query.isBlocked = isBlocked === 'true';
    }

    if (search && search.trim()) {
      const regex = { $regex: search.trim(), $options: 'i' };
      query.$or = [{ name: regex }, { email: regex }, { businessName: regex }];
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const pageSize = Math.max(1, parseInt(limit, 10));
    const skip = (pageNum - 1) * pageSize;

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize);

    return res.status(200).json({
      success: true,
      total,
      totalPages: Math.ceil(total / pageSize),
      currentPage: pageNum,
      users,
    });
  } catch (error) {
    console.error('Admin Get Users Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve registered users.',
    });
  }
};

/**
 * Admin: Get Single User Details with Associated Activity
 */
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid user ID.' });
    }

    const user = await User.findById(id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    let services = [];
    let bookings = [];

    if (user.role === 'vendor') {
      services = await Service.find({ vendorId: id }).sort({ createdAt: -1 });
    } else if (user.role === 'customer') {
      bookings = await Booking.find({ customerId: id })
        .populate('serviceId', 'serviceName images price')
        .sort({ createdAt: -1 });
    }

    return res.status(200).json({
      success: true,
      user,
      services,
      bookings,
    });
  } catch (error) {
    console.error('Admin Get User Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve user details.',
    });
  }
};

/**
 * Admin: Block or Unblock a User
 */
const toggleBlockUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid user ID.' });
    }

    const targetUser = await User.findById(id);
    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    // Protection: Admin cannot block themselves or other admins
    if (targetUser.role === 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Administrator accounts cannot be blocked.',
      });
    }

    targetUser.isBlocked = !targetUser.isBlocked;
    await targetUser.save();

    return res.status(200).json({
      success: true,
      message: `User has been successfully ${targetUser.isBlocked ? 'blocked' : 'unblocked'}.`,
      user: targetUser.toSafeObject(),
    });
  } catch (error) {
    console.error('Toggle Block User Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update user block status.',
    });
  }
};

/**
 * Admin: Get All Submitted Services with Filters (Pending, Approved, Rejected)
 */
const getAllServicesAdmin = async (req, res) => {
  try {
    const { status, category, search, page = 1, limit = 20 } = req.query;

    const query = {};

    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      query.status = status;
    }

    if (category && category !== 'All') {
      query.category = category;
    }

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

    return res.status(200).json({
      success: true,
      total,
      totalPages: Math.ceil(total / pageSize),
      currentPage: pageNum,
      services,
    });
  } catch (error) {
    console.error('Admin Get Services Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve services.',
    });
  }
};

/**
 * Admin: Approve, Reject, or Change Status of a Service
 */
const updateServiceStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid service ID.' });
    }

    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be "approved", "rejected", or "pending".',
      });
    }

    const service = await Service.findById(id).populate('vendorId', 'name email businessName');
    if (!service) {
      return res.status(404).json({ success: false, error: 'Service not found.' });
    }

    service.status = status;
    await service.save();

    return res.status(200).json({
      success: true,
      message: `Service status updated to "${status}".`,
      service,
    });
  } catch (error) {
    console.error('Update Service Status Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update service status.',
    });
  }
};

/**
 * Admin: Delete Inappropriate Service
 */
const deleteServiceAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid service ID.' });
    }

    const service = await Service.findByIdAndDelete(id);
    if (!service) {
      return res.status(404).json({ success: false, error: 'Service not found.' });
    }

    return res.status(200).json({
      success: true,
      message: 'Service deleted permanently by administrator.',
    });
  } catch (error) {
    console.error('Admin Delete Service Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete service.',
    });
  }
};

/**
 * Admin: View Platform Transactions (Read-only)
 */
const getAllTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;

    const query = {};
    if (status && ['succeeded', 'pending', 'failed'].includes(status)) {
      query.status = status;
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const pageSize = Math.max(1, parseInt(limit, 10));
    const skip = (pageNum - 1) * pageSize;

    const total = await Transaction.countDocuments(query);
    const transactions = await Transaction.find(query)
      .populate('vendorId', 'name email businessName image')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize);

    return res.status(200).json({
      success: true,
      total,
      totalPages: Math.ceil(total / pageSize),
      currentPage: pageNum,
      transactions,
    });
  } catch (error) {
    console.error('Admin Transactions Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve transactions.',
    });
  }
};

module.exports = {
  getAdminOverview,
  getAllUsers,
  getUserById,
  toggleBlockUser,
  getAllServicesAdmin,
  updateServiceStatus,
  deleteServiceAdmin,
  getAllTransactions,
};
