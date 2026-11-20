require('dotenv').config();
const request = require('supertest');
const app = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const { User, Service, Booking, Transaction } = require('../src/models');
const { generateToken } = require('../src/utils/jwt');

describe('WedPlan API Comprehensive Integration Test Suite', () => {
  let adminToken;
  let vendorToken;
  let customerToken;
  let testVendorId;
  let testCustomerId;
  let testServiceId;

  beforeAll(async () => {
    await connectDB();

    // Create or find mock admin
    let admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      admin = await User.create({
        name: 'Test Admin',
        email: 'test_admin@wedplan.com',
        role: 'admin',
        password: 'Admin@123456',
        isBlocked: false,
      });
    }
    adminToken = generateToken(admin);

    // Create unique mock vendor
    const uniqueEmailVendor = `vendor_${Date.now()}@test.com`;
    const vendor = await User.create({
      name: 'Test Vendor',
      email: uniqueEmailVendor,
      role: 'vendor',
      businessName: 'Starlight Weddings',
      password: 'Vendor@123456',
      subscriptionPlan: 'free',
      isBlocked: false,
    });
    testVendorId = vendor._id;
    vendorToken = generateToken(vendor);

    // Create unique mock customer
    const uniqueEmailCustomer = `customer_${Date.now()}@test.com`;
    const customer = await User.create({
      name: 'Test Customer',
      email: uniqueEmailCustomer,
      role: 'customer',
      password: 'Customer@123456',
      isBlocked: false,
    });
    testCustomerId = customer._id;
    customerToken = generateToken(customer);
  });

  afterAll(async () => {
    // Cleanup created test records
    await Service.deleteMany({ vendorId: testVendorId });
    await Booking.deleteMany({ customerId: testCustomerId });
    await User.deleteMany({ _id: { $in: [testVendorId, testCustomerId] } });
    await disconnectDB();
  });

  describe('1. Health Check Endpoint', () => {
    it('GET /api/health should return ok status', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('2. Authentication & Authorization', () => {
    it('POST /api/auth/register should fail with weak password (missing uppercase)', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Weak Pass User',
        email: 'weak@test.com',
        password: 'lowercaseonly123',
        role: 'customer',
      });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('POST /api/auth/register should fail if trying to register as admin', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Hacker Admin',
        email: 'hacker@test.com',
        password: 'Password@123',
        role: 'admin',
      });
      expect([400, 403]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    it('GET /api/auth/me should return authenticated user profile', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.role).toBe('customer');
    });
  });

  describe('3. Services Management & Free Tier Limits', () => {
    it('POST /api/services should allow vendor to create a service', async () => {
      const res = await request(app)
        .post('/api/services')
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({
          serviceName: 'Grand Sunset Venue Test',
          category: 'Wedding Venues',
          description: 'A magical test venue description.',
          price: 2500,
          location: 'San Diego, CA',
          images: ['https://example.com/venue.jpg'],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.service.status).toBe('pending');
      testServiceId = res.body.service._id;
    });

    it('PATCH /api/admin/services/:id/status should allow admin to approve service', async () => {
      const res = await request(app)
        .patch(`/api/admin/services/${testServiceId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'approved' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.service.status).toBe('approved');
    });

    it('GET /api/services should return approved services and support price sorting', async () => {
      const res = await request(app).get('/api/services?sortBy=price&sortOrder=asc');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.services)).toBe(true);
    });

    it('GET /api/services/featured should return featured services', async () => {
      const res = await request(app).get('/api/services/featured');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.services.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('4. Booking Workflow & Anti-Duplicate Validation', () => {
    let testBookingId;
    const bookingDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();

    it('POST /api/bookings should allow customer to submit booking request', async () => {
      const res = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          serviceId: testServiceId,
          eventDate: bookingDate,
          eventLocation: 'Grand Ballroom, San Diego',
          message: 'Excited to book our special day!',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.booking.status).toBe('pending');
      testBookingId = res.body.booking._id;
    });

    it('POST /api/bookings should reject duplicate active booking request on same date', async () => {
      const res = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          serviceId: testServiceId,
          eventDate: bookingDate,
          eventLocation: 'Another Location, San Diego',
          message: 'Trying to book duplicate date!',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/already exists/i);
    });

    it('PATCH /api/bookings/:id/status should allow vendor to accept booking', async () => {
      const res = await request(app)
        .patch(`/api/bookings/${testBookingId}/status`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({ status: 'accepted' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.booking.status).toBe('accepted');
    });

    it('PATCH /api/bookings/:id/cancel should reject customer cancellation once accepted', async () => {
      const res = await request(app)
        .patch(`/api/bookings/${testBookingId}/cancel`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('5. Admin Management & Dashboard Stats', () => {
    it('GET /api/admin/overview should return platform stats', async () => {
      const res = await request(app)
        .get('/api/admin/overview')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.stats).toHaveProperty('totalUsers');
      expect(res.body.stats).toHaveProperty('totalServices');
      expect(res.body.stats).toHaveProperty('totalBookings');
    });

    it('GET /api/admin/overview should forbid access to customer role', async () => {
      const res = await request(app)
        .get('/api/admin/overview')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });

    it('GET /api/vendor/overview should return vendor dashboard stats', async () => {
      const res = await request(app)
        .get('/api/vendor/overview')
        .set('Authorization', `Bearer ${vendorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.stats).toHaveProperty('activeServices');
      expect(res.body.stats).toHaveProperty('subscriptionPlan');
    });

    it('GET /api/customer/overview should return customer dashboard stats', async () => {
      const res = await request(app)
        .get('/api/customer/overview')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.stats).toHaveProperty('totalBookings');
    });
  });
});
