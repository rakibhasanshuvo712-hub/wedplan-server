const { User } = require('../models');
const config = require('../config');

const seedAdmin = async () => {
  try {
    const adminEmail = config.admin.email.toLowerCase();
    const existingAdmin = await User.findOne({ email: adminEmail });

    if (!existingAdmin) {
      console.log(`Seeding initial admin account: ${adminEmail}...`);
      await User.create({
        name: config.admin.name,
        email: adminEmail,
        password: config.admin.password, // Pre-save hook will hash this
        role: 'admin',
        isBlocked: false,
        subscriptionPlan: 'premium',
      });
      console.log(`Admin account seeded successfully: ${adminEmail}`);
    } else if (existingAdmin.role !== 'admin') {
      existingAdmin.role = 'admin';
      await existingAdmin.save();
      console.log(`Updated user ${adminEmail} to admin role.`);
    }
  } catch (error) {
    console.error('Admin Seeding Error:', error.message);
  }
};

module.exports = { seedAdmin };
