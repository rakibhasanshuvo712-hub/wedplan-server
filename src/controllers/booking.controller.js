const mongoose = require('mongoose');
const { Booking, Service } = require('../models');

/**
 * Customer: Submit a new booking request
 */
const createBooking = async (req, res) => {
  try {
    const { serviceId, eventDate, eventLocation, message } = req.body;

    if (!serviceId || !eventDate || !eventLocation) {
      return res.status(400).json({
        success: false,
        error: 'Service ID, event date, and event location are required.',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(serviceId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid service ID format.',
      });
    }

    // Admins and vendors cannot submit customer booking requests
    if (req.user.role !== 'customer') {
      return res.status(403).json({
        success: false,
        error: 'Only customer accounts can submit booking requests.',
      });
    }

    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({
        success: false,
        error: 'Service not found.',
      });
    }

    // Only approved and active services can be booked
    if (service.status !== 'approved' || !service.isActive) {
      return res.status(400).json({
        success: false,
        error: 'This service is currently unavailable for booking.',
      });
    }

    // Prevent customers from booking their own services (if user is also the vendor)
    if (service.vendorId.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        error: 'You cannot submit a booking request for your own service.',
      });
    }

    // Validate event date
    const parsedDate = new Date(eventDate);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid event date format.',
      });
    }

    // Check for duplicate active booking request on same service and date
    const startOfDay = new Date(parsedDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(parsedDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const duplicateBooking = await Booking.findOne({
      serviceId,
      eventDate: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ['pending', 'accepted'] },
    });

    if (duplicateBooking) {
      return res.status(400).json({
        success: false,
        error:
          'An active or accepted booking request already exists for this service on the selected date. Please choose a different date.',
      });
    }

    const newBooking = await Booking.create({
      serviceId,
      vendorId: service.vendorId,
      customerId: req.user._id,
      eventDate: parsedDate,
      eventLocation: eventLocation.trim(),
      message: (message || '').trim(),
      status: 'pending',
    });

    const populated = await Booking.findById(newBooking._id)
      .populate('serviceId', 'serviceName images category price location')
      .populate('vendorId', 'name email businessName image');

    return res.status(201).json({
      success: true,
      message: 'Booking request submitted successfully.',
      booking: populated,
    });
  } catch (error) {
    console.error('Create Booking Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to submit booking request.',
    });
  }
};

/**
 * Customer: View all booking requests submitted by the logged-in customer
 */
const getCustomerBookings = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const query = { customerId: req.user._id };
    if (status && ['pending', 'accepted', 'rejected', 'cancelled'].includes(status)) {
      query.status = status;
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const pageSize = Math.max(1, parseInt(limit, 10));
    const skip = (pageNum - 1) * pageSize;

    const total = await Booking.countDocuments(query);
    const bookings = await Booking.find(query)
      .populate('serviceId', 'serviceName images category price location')
      .populate('vendorId', 'name email businessName image')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize);

    return res.status(200).json({
      success: true,
      total,
      totalPages: Math.ceil(total / pageSize),
      currentPage: pageNum,
      bookings,
    });
  } catch (error) {
    console.error('Customer Bookings Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve your booking requests.',
    });
  }
};

/**
 * Vendor: View all booking requests for the logged-in vendor's services
 */
const getVendorBookings = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const query = { vendorId: req.user._id };
    if (status && ['pending', 'accepted', 'rejected', 'cancelled'].includes(status)) {
      query.status = status;
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const pageSize = Math.max(1, parseInt(limit, 10));
    const skip = (pageNum - 1) * pageSize;

    const total = await Booking.countDocuments(query);
    const bookings = await Booking.find(query)
      .populate('serviceId', 'serviceName images category price location')
      .populate('customerId', 'name email image')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize);

    return res.status(200).json({
      success: true,
      total,
      totalPages: Math.ceil(total / pageSize),
      currentPage: pageNum,
      bookings,
    });
  } catch (error) {
    console.error('Vendor Bookings Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve vendor booking requests.',
    });
  }
};

/**
 * Customer: Cancel pending booking request
 * Rules: Only pending requests can be cancelled. Cannot cancel accepted/rejected/cancelled.
 */
const cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid booking ID.' });
    }

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking request not found.' });
    }

    // Ownership check: must be customer who submitted it
    if (booking.customerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You cannot cancel a booking request belonging to another customer.',
      });
    }

    // Only pending can be cancelled
    if (booking.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `Cannot cancel a booking that is already ${booking.status}. Only pending requests can be cancelled.`,
      });
    }

    booking.status = 'cancelled';
    await booking.save();

    return res.status(200).json({
      success: true,
      message: 'Booking request cancelled successfully.',
      booking,
    });
  } catch (error) {
    console.error('Cancel Booking Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to cancel booking request.',
    });
  }
};

/**
 * Vendor: Accept or Reject a booking request
 * Rules:
 * - Only vendor who owns the service can update
 * - Only pending requests can be accepted or rejected
 * - Once accepted or rejected, cannot be modified again
 */
const updateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid booking ID.' });
    }

    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Status can only be updated to "accepted" or "rejected".',
      });
    }

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking request not found.' });
    }

    // Ownership check: must be the vendor of the booking
    if (booking.vendorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You can only manage booking requests for your own services.',
      });
    }

    // State validation
    if (booking.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `This request is already marked as "${booking.status}" and cannot be processed again.`,
      });
    }

    booking.status = status;
    await booking.save();

    return res.status(200).json({
      success: true,
      message: `Booking request has been ${status}.`,
      booking,
    });
  } catch (error) {
    console.error('Update Booking Status Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update booking status.',
    });
  }
};

/**
 * View Single Booking Details (Customer, Vendor, or Admin)
 */
const getBookingById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid booking ID.' });
    }

    const booking = await Booking.findById(id)
      .populate('serviceId')
      .populate('vendorId', 'name email businessName image')
      .populate('customerId', 'name email image');

    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking request not found.' });
    }

    const isCustomer = booking.customerId._id.toString() === req.user._id.toString();
    const isVendor = booking.vendorId._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isCustomer && !isVendor && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You do not have access to view this booking request.',
      });
    }

    return res.status(200).json({
      success: true,
      booking,
    });
  } catch (error) {
    console.error('Get Booking Details Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve booking details.',
    });
  }
};

module.exports = {
  createBooking,
  getCustomerBookings,
  getVendorBookings,
  cancelBooking,
  updateBookingStatus,
  getBookingById,
};
