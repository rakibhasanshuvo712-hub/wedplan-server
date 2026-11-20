const mongoose = require('mongoose');
const config = require('../config');
const { User, Service, Booking, Transaction } = require('../models');

const sampleServices = [
  {
    serviceName: 'The Grand Palace Ballroom & Gardens',
    category: 'Wedding Venues',
    description:
      'A breathtaking venue featuring crystal chandeliers, panoramic marble staircases, and manicured European gardens. Complete with indoor & outdoor reception spaces accommodating up to 450 guests.',
    price: 3500,
    location: 'Beverly Hills, CA',
    images: [
      'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1544077960-604201fe74bc?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&w=1200&q=80',
    ],
    status: 'approved',
    isActive: true,
  },
  {
    serviceName: 'Cinematic Romance 4K Photography & Drone',
    category: 'Photography & Videography',
    description:
      'Full-day luxury wedding coverage with 2 lead photographers, 1 videographer, drone aerial footage, 800+ color-graded images, teaser reel, and a 20-minute feature wedding film.',
    price: 2200,
    location: 'San Francisco, CA',
    images: [
      'https://images.unsplash.com/photo-1537633552985-df8429e8048b?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1606800052052-a08af7148866?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1200&q=80',
    ],
    status: 'approved',
    isActive: true,
  },
  {
    serviceName: 'Enchanted Rose Botanical Decor & Styling',
    category: 'Decoration & Florist',
    description:
      'Custom floral arches, romantic bridal bouquets, luxury hanging floral installations, customized centerpiece arrangements, and glowing fairy-light draping for ceremony and reception.',
    price: 1800,
    location: 'Napa Valley, CA',
    images: [
      'https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80',
    ],
    status: 'approved',
    isActive: true,
  },
  {
    serviceName: 'Haute Cuisine 5-Course Plated Wedding Feast',
    category: 'Catering Services',
    description:
      'Exquisite fine-dining catering curated by Michelin-trained chefs. Includes hors d’oeuvres cocktail hour, custom 5-course plated dinner, artisanal wedding cake, and champagne toast service.',
    price: 4200,
    location: 'Los Angeles, CA',
    images: [
      'https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80',
    ],
    status: 'approved',
    isActive: true,
  },
  {
    serviceName: 'Radiant Glow Bridal Hair & Airbrush Makeup',
    category: 'Makeup & Styling',
    description:
      'High-end bridal glamour including trial session, HD airbrush makeup resistant to tears and humidity, luxury lash extensions, customized hair updo styling, and touch-up kit.',
    price: 950,
    location: 'San Diego, CA',
    images: [
      'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1200&q=80',
    ],
    status: 'approved',
    isActive: true,
  },
  {
    serviceName: 'Atelier Couture Bridal Gowns & Tuxedos',
    category: 'Wedding Fashion',
    description:
      'Handcrafted designer wedding dresses, French lace veils, bespoke silk embroidery, and custom-tailored Italian wool groom tuxedos with personalized fitting appointments.',
    price: 2800,
    location: 'Newport Beach, CA',
    images: [
      'https://images.unsplash.com/photo-1594552072238-b8a33785b261?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1509967419530-da38b4704bc6?auto=format&fit=crop&w=1200&q=80',
    ],
    status: 'approved',
    isActive: true,
  },
  {
    serviceName: 'Oceanfront Sunset Cliffside Pavilion',
    category: 'Wedding Venues',
    description:
      'Perched high above Pacific waves, this cliffside pavilion offers 180-degree ocean views, glowing fire pits, and a private sandy cove for memorable ceremony vows.',
    price: 4900,
    location: 'Malibu, CA',
    images: [
      'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1200&q=80',
    ],
    status: 'approved',
    isActive: true,
  },
  {
    serviceName: 'Artisan Rustic Wooden Tables & Amber Lanterns',
    category: 'Decoration & Florist',
    description:
      'Farmhouse reclaimed wood dining tables, amber glass lantern pathways, macrame ceremony archways, and warm Edison bulb canopy installations for bohemian weddings.',
    price: 1400,
    location: 'Santa Barbara, CA',
    images: [
      'https://images.unsplash.com/photo-1478146896981-b80fe463b330?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&w=1200&q=80',
    ],
    status: 'approved',
    isActive: true,
  },
];

const seedDatabase = async () => {
  try {
    console.log('--- Starting WedPlan Database Seed ---');

    // 1. Seed or update Admin User
    let admin = await User.findOne({ email: config.admin.email.toLowerCase() });
    if (!admin) {
      admin = new User({
        name: config.admin.name,
        email: config.admin.email.toLowerCase(),
        password: config.admin.password,
        role: 'admin',
        isBlocked: false,
        image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
      });
      await admin.save();
      console.log(`Created default Admin: ${config.admin.email} / ${config.admin.password}`);
    } else {
      console.log(`Admin already exists: ${admin.email}`);
    }

    // 2. Seed Demo Vendor
    let vendor = await User.findOne({ email: 'vendor@wedplan.com' });
    if (!vendor) {
      vendor = new User({
        name: 'Eleanor Vance',
        email: 'vendor@wedplan.com',
        password: 'Vendor@123456',
        role: 'vendor',
        businessName: 'Royal Blooms & Grand Estates',
        subscriptionPlan: 'premium',
        isBlocked: false,
        image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&q=80',
      });
      await vendor.save();
      console.log('Created Demo Vendor: vendor@wedplan.com / Vendor@123456 (Premium)');
    }

    // 3. Seed Demo Customer
    let customer = await User.findOne({ email: 'customer@wedplan.com' });
    if (!customer) {
      customer = new User({
        name: 'Sarah Jenkins',
        email: 'customer@wedplan.com',
        password: 'Customer@123456',
        role: 'customer',
        isBlocked: false,
        image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80',
      });
      await customer.save();
      console.log('Created Demo Customer: customer@wedplan.com / Customer@123456');
    }

    // 4. Seed Services if empty
    const serviceCount = await Service.countDocuments();
    if (serviceCount === 0) {
      for (const item of sampleServices) {
        await Service.create({
          ...item,
          vendorId: vendor._id,
        });
      }
      console.log(`Seeded ${sampleServices.length} wedding services successfully.`);
    } else {
      console.log(`Database already has ${serviceCount} services. Skipping sample services.`);
    }

    // 5. Seed sample booking if empty
    const bookingCount = await Booking.countDocuments();
    if (bookingCount === 0) {
      const firstService = await Service.findOne();
      if (firstService) {
        const nextMonth = new Date();
        nextMonth.setDate(nextMonth.getDate() + 45);

        await Booking.create({
          serviceId: firstService._id,
          vendorId: vendor._id,
          customerId: customer._id,
          eventDate: nextMonth,
          eventLocation: 'Rosewood Garden Terrace, Beverly Hills',
          message: 'We are planning our outdoor sunset ceremony for ~150 guests. Would love to confirm availability!',
          status: 'pending',
        });
        console.log('Created sample pending booking request.');
      }
    }

    // 6. Seed sample transaction for vendor
    const txCount = await Transaction.countDocuments();
    if (txCount === 0) {
      await Transaction.create({
        vendorId: vendor._id,
        plan: 'premium',
        amount: 49.0,
        currency: 'usd',
        stripeSessionId: 'cs_test_seed_initial_premium_transaction',
        status: 'succeeded',
      });
      console.log('Created sample transaction record.');
    }

    console.log('--- Database Seed Complete ---');
  } catch (error) {
    console.error('Database Seed Error:', error);
  }
};

module.exports = { seedDatabase };
