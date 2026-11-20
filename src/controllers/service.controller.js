const mongoose = require('mongoose');
const { Service, serviceCategories } = require('../models');

/**
 * Public: Get all approved and active services with search, filtering, and sorting
 */
const getAllServices = async (req, res) => {
  try {
    const {
      search,
      category,
      location,
      minPrice,
      maxPrice,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 12,
    } = req.query;

    const query = {
      status: 'approved',
      isActive: true,
    };

    // Category filter
    if (category && category !== 'All') {
      query.category = category;
    }

    // Location filter
    if (location) {
      query.location = { $regex: location.trim(), $options: 'i' };
    }

    // Price range filter
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    // Advanced search across name, description, location, and category
    if (search && search.trim()) {
      const searchRegex = { $regex: search.trim(), $options: 'i' };
      query.$or = [
        { serviceName: searchRegex },
        { description: searchRegex },
        { location: searchRegex },
        { category: searchRegex },
      ];
    }

    // Sorting
    let sort = {};
    const order = sortOrder === 'asc' ? 1 : -1;
    if (sortBy === 'price') {
      sort.price = order;
    } else {
      sort[sortBy] = order;
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const pageSize = Math.max(1, parseInt(limit, 10));
    const skip = (pageNum - 1) * pageSize;

    const total = await Service.countDocuments(query);
    const services = await Service.find(query)
      .populate('vendorId', 'name email image businessName subscriptionPlan')
      .sort(sort)
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
    console.error('Get All Services Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve wedding services.',
    });
  }
};

/**
 * Public: Featured services for homepage (at least 6 approved services)
 */
const getFeaturedServices = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 6;
    const services = await Service.find({ status: 'approved', isActive: true })
      .populate('vendorId', 'name email image businessName subscriptionPlan')
      .sort({ createdAt: -1 })
      .limit(limit);

    return res.status(200).json({
      success: true,
      count: services.length,
      services,
    });
  } catch (error) {
    console.error('Featured Services Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve featured services.',
    });
  }
};

/**
 * Public: Service categories list with count of approved services
 */
const getCategories = async (req, res) => {
  try {
    const categoryCounts = await Service.aggregate([
      { $match: { status: 'approved', isActive: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]);

    const countMap = {};
    categoryCounts.forEach((c) => {
      countMap[c._id] = c.count;
    });

    const categories = serviceCategories.map((name) => ({
      name,
      count: countMap[name] || 0,
    }));

    return res.status(200).json({
      success: true,
      categories,
    });
  } catch (error) {
    console.error('Get Categories Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve service categories.',
    });
  }
};

/**
 * Public/Protected: Get single service details by ID
 */
const getServiceById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid service ID format.',
      });
    }

    const service = await Service.findById(id).populate(
      'vendorId',
      'name email image businessName subscriptionPlan isBlocked'
    );

    if (!service) {
      return res.status(404).json({
        success: false,
        error: 'Wedding service not found.',
      });
    }

    // Access control: If not approved or not active, only owner vendor or admin can view
    const isOwner =
      req.user &&
      service.vendorId &&
      service.vendorId._id.toString() === req.user._id.toString();
    const isAdmin = req.user && req.user.role === 'admin';

    if ((service.status !== 'approved' || !service.isActive) && !isOwner && !isAdmin) {
      return res.status(404).json({
        success: false,
        error: 'This service is currently unavailable or pending review.',
      });
    }

    return res.status(200).json({
      success: true,
      service,
    });
  } catch (error) {
    console.error('Get Service Details Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve service details.',
    });
  }
};

/**
 * Vendor: Create a new wedding service
 * Enforces Free Tier Limit: max 3 active services
 */
const createService = async (req, res) => {
  try {
    const { serviceName, category, description, price, location, images } = req.body;

    if (!serviceName || !category || !description || price === undefined || !location) {
      return res.status(400).json({
        success: false,
        error: 'Please provide service name, category, description, price, and location.',
      });
    }

    const imagesArray = Array.isArray(images)
      ? images.filter(Boolean)
      : typeof images === 'string' && images.trim()
      ? [images.trim()]
      : [];

    if (imagesArray.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one service image is required.',
      });
    }

    // Check Free Plan limitation
    const isPremium = req.user.subscriptionPlan === 'premium';
    if (!isPremium) {
      const activeCount = await Service.countDocuments({
        vendorId: req.user._id,
        status: { $ne: 'rejected' },
        isActive: true,
      });

      if (activeCount >= 3) {
        return res.status(403).json({
          success: false,
          error:
            'Free plan limit reached: You can publish a maximum of 3 active services. Upgrade to Premium to publish unlimited services.',
          upgradeRequired: true,
        });
      }
    }

    const newService = await Service.create({
      vendorId: req.user._id,
      serviceName: serviceName.trim(),
      category: category.trim(),
      description: description.trim(),
      price: Number(price),
      location: location.trim(),
      images: imagesArray,
      status: 'pending', // Default status pending until approved by admin
      isActive: true,
    });

    return res.status(201).json({
      success: true,
      message: 'Service submitted successfully and is pending administrator review.',
      service: newService,
    });
  } catch (error) {
    console.error('Create Service Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to create service.',
    });
  }
};

/**
 * Vendor: Update own service
 */
const updateService = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid service ID.' });
    }

    const service = await Service.findById(id);
    if (!service) {
      return res.status(404).json({ success: false, error: 'Service not found.' });
    }

    // Check ownership
    const isOwner = service.vendorId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You do not have permission to modify this service.',
      });
    }

    const { serviceName, category, description, price, location, images, isActive } =
      req.body;

    if (serviceName) service.serviceName = serviceName.trim();
    if (category) service.category = category.trim();
    if (description) service.description = description.trim();
    if (price !== undefined) service.price = Number(price);
    if (location) service.location = location.trim();
    if (Array.isArray(images) && images.length > 0) service.images = images;
    if (typeof isActive === 'boolean') service.isActive = isActive;

    // If a rejected service is edited by vendor, reset to pending for re-review
    if (isOwner && service.status === 'rejected') {
      service.status = 'pending';
    }

    await service.save();

    return res.status(200).json({
      success: true,
      message: 'Service updated successfully.',
      service,
    });
  } catch (error) {
    console.error('Update Service Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update service.',
    });
  }
};

/**
 * Vendor: Delete own service (or Admin delete)
 */
const deleteService = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid service ID.' });
    }

    const service = await Service.findById(id);
    if (!service) {
      return res.status(404).json({ success: false, error: 'Service not found.' });
    }

    const isOwner = service.vendorId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You do not have permission to delete this service.',
      });
    }

    await Service.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: 'Service deleted successfully.',
    });
  } catch (error) {
    console.error('Delete Service Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete service.',
    });
  }
};

/**
 * Vendor: Toggle service availability (active / inactive)
 */
const toggleAvailability = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid service ID.' });
    }

    const service = await Service.findById(id);
    if (!service) {
      return res.status(404).json({ success: false, error: 'Service not found.' });
    }

    if (service.vendorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You can only manage availability of your own services.',
      });
    }

    service.isActive = !service.isActive;
    await service.save();

    return res.status(200).json({
      success: true,
      message: `Service is now ${service.isActive ? 'available' : 'hidden'}.`,
      isActive: service.isActive,
    });
  } catch (error) {
    console.error('Toggle Availability Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to toggle service availability.',
    });
  }
};

/**
 * Vendor: Get all services belonging to the logged-in vendor
 */
const getMyServices = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const query = { vendorId: req.user._id };
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      query.status = status;
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const pageSize = Math.max(1, parseInt(limit, 10));
    const skip = (pageNum - 1) * pageSize;

    const total = await Service.countDocuments(query);
    const services = await Service.find(query)
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
    console.error('Get Vendor Services Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve vendor services.',
    });
  }
};

module.exports = {
  getAllServices,
  getFeaturedServices,
  getCategories,
  getServiceById,
  createService,
  updateService,
  deleteService,
  toggleAvailability,
  getMyServices,
};
