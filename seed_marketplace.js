const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.DB_URI;
if (!uri) {
  console.error('Error: DB_URI environment variable is not defined in .env or environment.');
  process.exit(1);
}

async function seedCompleteMarketplace() {
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  // 1. Ensure Admins, Vendors, and Customers
  const bcrypt = require('bcryptjs');
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('Vendor@123456', salt);
  const customerPassword = await bcrypt.hash('Customer@123456', salt);

  const vendorList = [
    {
      name: 'Eleanor Vance',
      email: 'vendor@wedplan.com',
      password: hashedPassword,
      role: 'vendor',
      businessName: 'Bella Rose Luxury Events & Estates',
      isBlocked: false,
      subscriptionPlan: 'premium',
      image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80',
      createdAt: new Date('2026-01-10T08:00:00Z'),
      updatedAt: new Date('2026-01-10T08:00:00Z'),
    },
    {
      name: 'Marcus Thorne',
      email: 'marcus.cine@wedplan.com',
      password: hashedPassword,
      role: 'vendor',
      businessName: 'Thorne & Co. Cinematic Visuals',
      isBlocked: false,
      subscriptionPlan: 'premium',
      image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
      createdAt: new Date('2026-01-12T08:00:00Z'),
      updatedAt: new Date('2026-01-12T08:00:00Z'),
    },
    {
      name: 'Chef Antoine Laurent',
      email: 'antoine.catering@wedplan.com',
      password: hashedPassword,
      role: 'vendor',
      businessName: 'Laurent Haute Gastronomie',
      isBlocked: false,
      subscriptionPlan: 'premium',
      image: 'https://images.unsplash.com/photo-1583394293214-28ded15ee548?auto=format&fit=crop&w=400&q=80',
      createdAt: new Date('2026-01-15T08:00:00Z'),
      updatedAt: new Date('2026-01-15T08:00:00Z'),
    },
    {
      name: 'Chloe St. Claire',
      email: 'chloe.botanicals@wedplan.com',
      password: hashedPassword,
      role: 'vendor',
      businessName: 'St. Claire Botanical & Floristry',
      isBlocked: false,
      subscriptionPlan: 'free',
      image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
      createdAt: new Date('2026-01-18T08:00:00Z'),
      updatedAt: new Date('2026-01-18T08:00:00Z'),
    },
    {
      name: 'Sofia Rossi',
      email: 'sofia.couture@wedplan.com',
      password: hashedPassword,
      role: 'vendor',
      businessName: 'Atelier Rossi Bridal Couture',
      isBlocked: false,
      subscriptionPlan: 'premium',
      image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
      createdAt: new Date('2026-01-20T08:00:00Z'),
      updatedAt: new Date('2026-01-20T08:00:00Z'),
    },
    {
      name: 'Alexander Wright',
      email: 'alex.estates@wedplan.com',
      password: hashedPassword,
      role: 'vendor',
      businessName: 'Pacific Heritage Solariums & Venues',
      isBlocked: false,
      subscriptionPlan: 'free',
      image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
      createdAt: new Date('2026-01-22T08:00:00Z'),
      updatedAt: new Date('2026-01-22T08:00:00Z'),
    },
  ];

  const vendorMap = {};

  for (const v of vendorList) {
    const existing = await db.collection('users').findOne({ email: v.email });
    if (!existing) {
      const res = await db.collection('users').insertOne(v);
      vendorMap[v.email] = res.insertedId;
      console.log('Created vendor:', v.businessName);
    } else {
      vendorMap[v.email] = existing._id;
      await db.collection('users').updateOne(
        { _id: existing._id },
        {
          $set: {
            businessName: v.businessName,
            subscriptionPlan: v.subscriptionPlan,
            image: v.image,
          },
        }
      );
      console.log('Updated vendor:', v.businessName);
    }
  }

  // Customers
  const customerList = [
    {
      name: 'Sarah Jenkins',
      email: 'customer@wedplan.com',
      password: customerPassword,
      role: 'customer',
      isBlocked: false,
      image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
      createdAt: new Date('2026-01-05T08:00:00Z'),
      updatedAt: new Date('2026-01-05T08:00:00Z'),
    },
    {
      name: 'Jessica Parker',
      email: 'jessica.parker@example.com',
      password: customerPassword,
      role: 'customer',
      isBlocked: false,
      image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=400&q=80',
      createdAt: new Date('2026-01-08T08:00:00Z'),
      updatedAt: new Date('2026-01-08T08:00:00Z'),
    },
    {
      name: 'Michael Chen',
      email: 'michael.chen@example.com',
      password: customerPassword,
      role: 'customer',
      isBlocked: false,
      image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80',
      createdAt: new Date('2026-01-14T08:00:00Z'),
      updatedAt: new Date('2026-01-14T08:00:00Z'),
    },
  ];

  const customerMap = {};
  for (const c of customerList) {
    const existing = await db.collection('users').findOne({ email: c.email });
    if (!existing) {
      const res = await db.collection('users').insertOne(c);
      customerMap[c.email] = res.insertedId;
      console.log('Created customer:', c.name);
    } else {
      customerMap[c.email] = existing._id;
    }
  }

  // 2. Clear old services and insert full enriched catalog distributed across vendors
  await db.collection('services').deleteMany({});

  const services = [
    // Venues
    {
      vendorId: vendorMap['vendor@wedplan.com'],
      serviceName: 'The Grand Palace Ballroom & European Gardens',
      category: 'Wedding Venues',
      description: 'A breathtaking historic estate featuring soaring crystal chandeliers, double curved marble staircases, and manicured European gardens with fountains. Complete with indoor & outdoor reception spaces accommodating up to 450 guests.',
      price: 3500,
      location: 'Beverly Hills, CA',
      images: [
        'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1544077960-604201fe74bc?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&w=1200&q=80',
      ],
      status: 'approved',
      isActive: true,
      createdAt: new Date('2026-01-15T10:00:00Z'),
      updatedAt: new Date('2026-01-15T10:00:00Z'),
    },
    {
      vendorId: vendorMap['alex.estates@wedplan.com'],
      serviceName: 'Historic Glasshouse Conservatory & Solarium',
      category: 'Wedding Venues',
      description: 'Stunning 19th-century wrought-iron greenhouse with lush tropical palm trees, blooming exotic orchids, cathedral glass ceilings for night stargazing, and private climate-controlled bridal suites.',
      price: 4500,
      location: 'Portland, OR',
      images: [
        'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&w=1200&q=80',
      ],
      status: 'approved',
      isActive: true,
      createdAt: new Date('2026-01-16T10:00:00Z'),
      updatedAt: new Date('2026-01-16T10:00:00Z'),
    },
    {
      vendorId: vendorMap['vendor@wedplan.com'],
      serviceName: 'Tuscan Stone Villa & Vineyard Estate',
      category: 'Wedding Venues',
      description: 'Old-world Mediterranean elegance featuring cypress-lined pathways, private olive groves, an infinity pool cocktail terrace, and candlelit wine cellar receptions overlooking Sonoma hills.',
      price: 5400,
      location: 'Sonoma, CA',
      images: [
        'https://images.unsplash.com/photo-1544077960-604201fe74bc?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1200&q=80',
      ],
      status: 'approved',
      isActive: true,
      createdAt: new Date('2026-01-18T10:00:00Z'),
      updatedAt: new Date('2026-01-18T10:00:00Z'),
    },
    {
      vendorId: vendorMap['alex.estates@wedplan.com'],
      serviceName: 'Oceanfront Sunset Cliffside Pavilion',
      category: 'Wedding Venues',
      description: 'Perched high above Pacific surf, this cliffside pavilion offers 180-degree ocean views, glowing fire pits, and a private sandy cove for memorable ceremony vows.',
      price: 4900,
      location: 'Malibu, CA',
      images: [
        'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1544077960-604201fe74bc?auto=format&fit=crop&w=1200&q=80',
      ],
      status: 'approved',
      isActive: true,
      createdAt: new Date('2026-01-20T10:00:00Z'),
      updatedAt: new Date('2026-01-20T10:00:00Z'),
    },

    // Photography & Videography
    {
      vendorId: vendorMap['marcus.cine@wedplan.com'],
      serviceName: 'Cinematic Romance 4K Photography & Drone',
      category: 'Photography & Videography',
      description: 'Full-day luxury wedding coverage with 2 lead photographers, 1 videographer, drone aerial footage, 800+ color-graded images, teaser reel, and a 20-minute feature wedding film.',
      price: 2200,
      location: 'San Francisco, CA',
      images: [
        'https://images.unsplash.com/photo-1537633552985-df8429e8048b?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1606800052052-a08af7148866?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1200&q=80',
      ],
      status: 'approved',
      isActive: true,
      createdAt: new Date('2026-01-22T10:00:00Z'),
      updatedAt: new Date('2026-01-22T10:00:00Z'),
    },
    {
      vendorId: vendorMap['marcus.cine@wedplan.com'],
      serviceName: 'Golden Hour Editorial Wedding Film & Drone',
      category: 'Photography & Videography',
      description: 'Documentary style emotional storytelling with warm golden tones, super 8mm vintage film clips, 4K aerial drone views, and same-week highlight reels for destination celebrations.',
      price: 2600,
      location: 'Aspen, CO',
      images: [
        'https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80',
      ],
      status: 'approved',
      isActive: true,
      createdAt: new Date('2026-01-24T10:00:00Z'),
      updatedAt: new Date('2026-01-24T10:00:00Z'),
    },
    {
      vendorId: vendorMap['marcus.cine@wedplan.com'],
      serviceName: 'Vogue-Inspired Destination Wedding Photography',
      category: 'Photography & Videography',
      description: 'High-fashion editorial aesthetic, golden sunset portraits, candid romantic storytelling, waterproof drone coverage, and archival linen photo albums for seaside couples.',
      price: 2900,
      location: 'Honolulu, HI',
      images: [
        'https://images.unsplash.com/photo-1537633552985-df8429e8048b?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1606800052052-a08af7148866?auto=format&fit=crop&w=1200&q=80',
      ],
      status: 'approved',
      isActive: true,
      createdAt: new Date('2026-01-26T10:00:00Z'),
      updatedAt: new Date('2026-01-26T10:00:00Z'),
    },

    // Decoration & Florist
    {
      vendorId: vendorMap['chloe.botanicals@wedplan.com'],
      serviceName: 'Enchanted Rose Botanical Decor & Styling',
      category: 'Decoration & Florist',
      description: 'Custom floral arches, romantic bridal bouquets, luxury hanging floral installations, customized centerpiece arrangements, and glowing fairy-light draping for ceremony and reception.',
      price: 1800,
      location: 'Napa Valley, CA',
      images: [
        'https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?auto=format&fit=crop&w=1200&q=80',
      ],
      status: 'approved',
      isActive: true,
      createdAt: new Date('2026-01-28T10:00:00Z'),
      updatedAt: new Date('2026-01-28T10:00:00Z'),
    },
    {
      vendorId: vendorMap['chloe.botanicals@wedplan.com'],
      serviceName: 'Boho Pampas Grass & Crystal Chandelier Decor',
      category: 'Decoration & Florist',
      description: 'Earthy neutral tones, dried floral meadows, handwoven macrame backdrops, suspended crystal chandeliers, and ambient brass lanterns for modern bohemian celebrations.',
      price: 1650,
      location: 'Austin, TX',
      images: [
        'https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?auto=format&fit=crop&w=1200&q=80',
      ],
      status: 'approved',
      isActive: true,
      createdAt: new Date('2026-01-30T10:00:00Z'),
      updatedAt: new Date('2026-01-30T10:00:00Z'),
    },
    {
      vendorId: vendorMap['chloe.botanicals@wedplan.com'],
      serviceName: 'Artisan Rustic Wooden Tables & Amber Lanterns',
      category: 'Decoration & Florist',
      description: 'Farmhouse reclaimed wood tables, French crossback chairs, wrought-iron hanging chandeliers, and vintage glassware styling for vineyard and barn ceremonies.',
      price: 1400,
      location: 'Santa Barbara, CA',
      images: [
        'https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80',
      ],
      status: 'approved',
      isActive: true,
      createdAt: new Date('2026-02-01T10:00:00Z'),
      updatedAt: new Date('2026-02-01T10:00:00Z'),
    },

    // Catering Services
    {
      vendorId: vendorMap['antoine.catering@wedplan.com'],
      serviceName: 'Haute Cuisine 5-Course Plated Wedding Feast',
      category: 'Catering Services',
      description: 'Exquisite fine-dining catering curated by Michelin-trained chefs. Includes hors d’oeuvres cocktail hour, custom 5-course plated dinner, artisanal wedding cake, and champagne toast service.',
      price: 4200,
      location: 'Los Angeles, CA',
      images: [
        'https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80',
      ],
      status: 'approved',
      isActive: true,
      createdAt: new Date('2026-02-03T10:00:00Z'),
      updatedAt: new Date('2026-02-03T10:00:00Z'),
    },
    {
      vendorId: vendorMap['antoine.catering@wedplan.com'],
      serviceName: 'Artisanal Wood-Fired Feast & Craft Cocktail Lounge',
      category: 'Catering Services',
      description: 'Live wood-fired open kitchen serving smoked prime cuts, artisanal sourdough flatbreads, organic seasonal harvests, and interactive mixology craft cocktail bar.',
      price: 3800,
      location: 'Seattle, WA',
      images: [
        'https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80',
      ],
      status: 'approved',
      isActive: true,
      createdAt: new Date('2026-02-05T10:00:00Z'),
      updatedAt: new Date('2026-02-05T10:00:00Z'),
    },

    // Makeup & Styling
    {
      vendorId: vendorMap['vendor@wedplan.com'],
      serviceName: 'Radiant Glow Bridal Hair & Airbrush Makeup',
      category: 'Makeup & Styling',
      description: 'High-end bridal glamour including trial session, HD airbrush makeup resistant to tears and humidity, luxury lash extensions, customized hair updo styling, and touch-up kit.',
      price: 950,
      location: 'San Diego, CA',
      images: [
        'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1200&q=80',
      ],
      status: 'approved',
      isActive: true,
      createdAt: new Date('2026-02-07T10:00:00Z'),
      updatedAt: new Date('2026-02-07T10:00:00Z'),
    },
    {
      vendorId: vendorMap['vendor@wedplan.com'],
      serviceName: 'Classic Glamour Bridal Beauty & Hair Artistry',
      category: 'Makeup & Styling',
      description: 'Timeless Hollywood waves, luminous airbrush complexion, custom mink lashes, and on-site touch-ups throughout bridal party photo sessions.',
      price: 850,
      location: 'Chicago, IL',
      images: [
        'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1200&q=80',
      ],
      status: 'approved',
      isActive: true,
      createdAt: new Date('2026-02-09T10:00:00Z'),
      updatedAt: new Date('2026-02-09T10:00:00Z'),
    },

    // Wedding Fashion
    {
      vendorId: vendorMap['sofia.couture@wedplan.com'],
      serviceName: 'Atelier Couture Bridal Gowns & Tuxedos',
      category: 'Wedding Fashion',
      description: 'Handcrafted designer wedding dresses, French lace veils, bespoke silk embroidery, and custom-tailored Italian wool groom tuxedos with personalized fitting appointments.',
      price: 2800,
      location: 'Newport Beach, CA',
      images: [
        'https://images.unsplash.com/photo-1594552072238-b8a33785b261?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&w=1200&q=80',
      ],
      status: 'approved',
      isActive: true,
      createdAt: new Date('2026-02-11T10:00:00Z'),
      updatedAt: new Date('2026-02-11T10:00:00Z'),
    },
    {
      vendorId: vendorMap['sofia.couture@wedplan.com'],
      serviceName: 'Royal Velvet & Silk Bridal Couture Collection',
      category: 'Wedding Fashion',
      description: 'Intricately beaded cathedral trains, Swarovski crystal accents, bespoke silk suits for the wedding party, and custom veil embroidery.',
      price: 3100,
      location: 'Miami, FL',
      images: [
        'https://images.unsplash.com/photo-1594552072238-b8a33785b261?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1509967419530-da38b4704bc6?auto=format&fit=crop&w=1200&q=80',
      ],
      status: 'approved',
      isActive: true,
      createdAt: new Date('2026-02-13T10:00:00Z'),
      updatedAt: new Date('2026-02-13T10:00:00Z'),
    },
  ];

  const insertedServices = await db.collection('services').insertMany(services);
  console.log(`Inserted ${insertedServices.insertedCount} services.`);

  // 3. Clear and seed realistic Bookings
  await db.collection('bookings').deleteMany({});

  const s = await db.collection('services').find({}).toArray();
  const cSarah = customerMap['customer@wedplan.com'];
  const cJessica = customerMap['jessica.parker@example.com'];
  const cMichael = customerMap['michael.chen@example.com'];

  const bookings = [
    {
      serviceId: s[0]._id, // Grand Palace
      vendorId: s[0].vendorId,
      customerId: cSarah,
      eventDate: new Date('2026-10-18T18:00:00Z'),
      eventLocation: 'Rosewood Garden Terrace, Beverly Hills, CA',
      message: 'Looking forward to hosting our evening reception here! We expect around 175 guests and require catering staging.',
      status: 'pending',
      createdAt: new Date('2026-02-14T11:00:00Z'),
      updatedAt: new Date('2026-02-14T11:00:00Z'),
    },
    {
      serviceId: s[4]._id, // Cinematic 4K
      vendorId: s[4].vendorId,
      customerId: cSarah,
      eventDate: new Date('2026-11-20T14:00:00Z'),
      eventLocation: 'Presidio Golden Gate Park, San Francisco, CA',
      message: 'We loved your drone highlight reel! Would love to book the full-day video and photography package.',
      status: 'accepted',
      createdAt: new Date('2026-02-08T09:30:00Z'),
      updatedAt: new Date('2026-02-09T14:20:00Z'),
    },
    {
      serviceId: s[7]._id, // Enchanted Rose
      vendorId: s[7].vendorId,
      customerId: cSarah,
      eventDate: new Date('2026-09-05T16:00:00Z'),
      eventLocation: 'St. Helena Vineyard, Napa Valley, CA',
      message: 'Inquiring about autumn botanical styling with blush and terracotta florals.',
      status: 'cancelled',
      cancellationReason: 'Moved celebration date due to travel logistics.',
      createdAt: new Date('2026-01-25T15:00:00Z'),
      updatedAt: new Date('2026-01-26T10:00:00Z'),
    },
    {
      serviceId: s[10]._id, // Haute Cuisine
      vendorId: s[10].vendorId,
      customerId: cJessica,
      eventDate: new Date('2026-12-04T17:30:00Z'),
      eventLocation: 'Bel Air Country Club, Los Angeles, CA',
      message: 'Planning a plated reception for 200 guests. Please let us know tasting availability.',
      status: 'pending',
      createdAt: new Date('2026-02-15T16:00:00Z'),
      updatedAt: new Date('2026-02-15T16:00:00Z'),
    },
    {
      serviceId: s[14]._id, // Atelier Couture
      vendorId: s[14].vendorId,
      customerId: cJessica,
      eventDate: new Date('2026-08-22T13:00:00Z'),
      eventLocation: 'Balboa Bay Club, Newport Beach, CA',
      message: 'Would like to book a private bridal party custom gown and tuxedo fitting consultation.',
      status: 'accepted',
      createdAt: new Date('2026-02-02T10:00:00Z'),
      updatedAt: new Date('2026-02-03T11:00:00Z'),
    },
    {
      serviceId: s[1]._id, // Historic Glasshouse
      vendorId: s[1].vendorId,
      customerId: cMichael,
      eventDate: new Date('2026-10-10T16:00:00Z'),
      eventLocation: 'Forest Park Conservatory, Portland, OR',
      message: 'Requesting the botanical glasshouse for our autumn wedding ceremony.',
      status: 'pending',
      createdAt: new Date('2026-02-16T12:00:00Z'),
      updatedAt: new Date('2026-02-16T12:00:00Z'),
    },
  ];

  const insertedBookings = await db.collection('bookings').insertMany(bookings);
  console.log(`Inserted ${insertedBookings.insertedCount} bookings.`);

  // 4. Seed realistic Stripe Transactions for Admin overview & transactions
  await db.collection('transactions').deleteMany({});

  const transactions = [
    {
      vendorId: vendorMap['vendor@wedplan.com'],
      plan: 'Premium Vendor Lifetime Membership',
      amount: 49,
      currency: 'usd',
      stripeSessionId: 'cs_test_a1b2c3d4e5f6g7h8_1',
      stripePaymentIntentId: 'pi_3MtwLwLkdIwHu7ix0aaa1111',
      status: 'succeeded',
      paymentMethod: 'card',
      createdAt: new Date('2026-02-01T14:30:00Z'),
      updatedAt: new Date('2026-02-01T14:30:00Z'),
    },
    {
      vendorId: vendorMap['marcus.cine@wedplan.com'],
      plan: 'Premium Vendor Lifetime Membership',
      amount: 49,
      currency: 'usd',
      stripeSessionId: 'cs_test_b2c3d4e5f6g7h8i9_2',
      stripePaymentIntentId: 'pi_3MtwLwLkdIwHu7ix0bbb2222',
      status: 'succeeded',
      paymentMethod: 'card',
      createdAt: new Date('2026-02-05T16:15:00Z'),
      updatedAt: new Date('2026-02-05T16:15:00Z'),
    },
    {
      vendorId: vendorMap['antoine.catering@wedplan.com'],
      plan: 'Premium Vendor Lifetime Membership',
      amount: 49,
      currency: 'usd',
      stripeSessionId: 'cs_test_c3d4e5f6g7h8i9j0_3',
      stripePaymentIntentId: 'pi_3MtwLwLkdIwHu7ix0ccc3333',
      status: 'succeeded',
      paymentMethod: 'card',
      createdAt: new Date('2026-02-08T11:45:00Z'),
      updatedAt: new Date('2026-02-08T11:45:00Z'),
    },
    {
      vendorId: vendorMap['sofia.couture@wedplan.com'],
      plan: 'Premium Vendor Lifetime Membership',
      amount: 49,
      currency: 'usd',
      stripeSessionId: 'cs_test_d4e5f6g7h8i9j0k1_4',
      stripePaymentIntentId: 'pi_3MtwLwLkdIwHu7ix0ddd4444',
      status: 'succeeded',
      paymentMethod: 'card',
      createdAt: new Date('2026-02-12T09:20:00Z'),
      updatedAt: new Date('2026-02-12T09:20:00Z'),
    },
  ];

  const insertedTx = await db.collection('transactions').insertMany(transactions);
  console.log(`Inserted ${insertedTx.insertedCount} transactions.`);

  // 5. Seed separate VENDORS collection
  await db.collection('vendors').deleteMany({});
  const vendorProfiles = [
    {
      userId: vendorMap['vendor@wedplan.com'],
      name: 'Eleanor Vance',
      businessName: 'Bella Rose Luxury Events & Estates',
      email: 'vendor@wedplan.com',
      phone: '+1 (310) 555-0192',
      address: 'Beverly Hills, CA',
      bio: 'Award-winning architectural wedding designer and luxury estate proprietor specializing in timeless European-inspired celebrations.',
      image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
      subscriptionPlan: 'premium',
      totalServices: 3,
      rating: 4.95,
      reviewCount: 48,
      isVerified: true,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-02-01T14:30:00Z'),
    },
    {
      userId: vendorMap['marcus.cine@wedplan.com'],
      name: 'Marcus Thorne',
      businessName: 'Thorne & Co. Cinematic Visuals',
      email: 'marcus.cine@wedplan.com',
      phone: '+1 (415) 555-0143',
      address: 'San Francisco, CA',
      bio: 'Master wedding filmmaker and editorial photographer crafting cinematic heirlooms featured in Vogue Weddings and The Knot.',
      image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
      subscriptionPlan: 'premium',
      totalServices: 3,
      rating: 4.98,
      reviewCount: 39,
      isVerified: true,
      createdAt: new Date('2026-01-02T00:00:00Z'),
      updatedAt: new Date('2026-02-05T16:15:00Z'),
    },
    {
      userId: vendorMap['antoine.catering@wedplan.com'],
      name: 'Chef Antoine Laurent',
      businessName: 'Laurent Haute Gastronomie',
      email: 'antoine.catering@wedplan.com',
      phone: '+1 (212) 555-0188',
      address: 'New York, NY',
      bio: 'Michelin-trained executive culinary team delivering bespoke multi-course menus and theatrical artisanal beverage experiences.',
      image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
      subscriptionPlan: 'premium',
      totalServices: 2,
      rating: 4.92,
      reviewCount: 31,
      isVerified: true,
      createdAt: new Date('2026-01-03T00:00:00Z'),
      updatedAt: new Date('2026-02-08T11:45:00Z'),
    },
    {
      userId: vendorMap['chloe.botanicals@wedplan.com'],
      name: 'Chloe St. Claire',
      businessName: 'St. Claire Botanical & Floristry',
      email: 'chloe.botanicals@wedplan.com',
      phone: '+1 (503) 555-0112',
      address: 'Portland, OR',
      bio: 'Artisan floral architects sculpting ethereal floral arches, bespoke bridal bouquets, and suspension ceiling gardens.',
      image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
      subscriptionPlan: 'free',
      totalServices: 3,
      rating: 4.90,
      reviewCount: 27,
      isVerified: true,
      createdAt: new Date('2026-01-04T00:00:00Z'),
      updatedAt: new Date('2026-01-04T00:00:00Z'),
    },
    {
      userId: vendorMap['sofia.couture@wedplan.com'],
      name: 'Sofia Rossi',
      businessName: 'Atelier Rossi Bridal Couture',
      email: 'sofia.couture@wedplan.com',
      phone: '+1 (305) 555-0177',
      address: 'Miami, FL',
      bio: 'Haute couture bridal atelier and Milanese styling suite crafting made-to-measure silk gowns and bespoke veils.',
      image: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
      subscriptionPlan: 'premium',
      totalServices: 3,
      rating: 4.99,
      reviewCount: 42,
      isVerified: true,
      createdAt: new Date('2026-01-05T00:00:00Z'),
      updatedAt: new Date('2026-02-12T09:20:00Z'),
    },
    {
      userId: vendorMap['alex.estates@wedplan.com'],
      name: 'Alexander Wright',
      businessName: 'Pacific Heritage Solariums & Venues',
      email: 'alex.estates@wedplan.com',
      phone: '+1 (206) 555-0165',
      address: 'Seattle, WA',
      bio: 'Curator of glass conservatory ballrooms, scenic beachfront pavilions, and historic coastal estate grounds.',
      image: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=80',
      subscriptionPlan: 'free',
      totalServices: 2,
      rating: 4.88,
      reviewCount: 19,
      isVerified: true,
      createdAt: new Date('2026-01-06T00:00:00Z'),
      updatedAt: new Date('2026-01-06T00:00:00Z'),
    },
  ];
  await db.collection('vendors').insertMany(vendorProfiles);
  console.log('Seeded vendors collection with 6 vendor records.');

  // 6. Seed separate CUSTOMERS collection
  await db.collection('customers').deleteMany({});
  const customerProfiles = [
    {
      userId: customerMap['customer@wedplan.com'],
      name: 'Sarah Jenkins',
      email: 'customer@wedplan.com',
      phone: '+1 (415) 555-0174',
      image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
      weddingDate: new Date('2026-09-18T00:00:00Z'),
      partnerName: 'David Miller',
      budget: 65000,
      location: 'Santa Barbara, CA',
      notes: 'Planning an outdoor coastal European garden wedding for 180 guests.',
      createdAt: new Date('2026-01-05T08:00:00Z'),
      updatedAt: new Date('2026-01-05T08:00:00Z'),
    },
    {
      userId: customerMap['jessica.parker@example.com'],
      name: 'Jessica Parker',
      email: 'jessica.parker@example.com',
      phone: '+1 (212) 555-0129',
      image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=400&q=80',
      weddingDate: new Date('2026-10-10T00:00:00Z'),
      partnerName: 'James Wilson',
      budget: 85000,
      location: 'Napa Valley, CA',
      notes: 'Looking for luxury vineyard reception and cinematic videography.',
      createdAt: new Date('2026-01-08T08:00:00Z'),
      updatedAt: new Date('2026-01-08T08:00:00Z'),
    },
    {
      userId: customerMap['michael.chen@example.com'],
      name: 'Michael Chen',
      email: 'michael.chen@example.com',
      phone: '+1 (206) 555-0199',
      image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80',
      weddingDate: new Date('2026-11-07T00:00:00Z'),
      partnerName: 'Emily Taylor',
      budget: 45000,
      location: 'Seattle, WA',
      notes: 'Glass atrium evening reception with live jazz and bespoke botanical styling.',
      createdAt: new Date('2026-01-14T08:00:00Z'),
      updatedAt: new Date('2026-01-14T08:00:00Z'),
    },
  ];
  await db.collection('customers').insertMany(customerProfiles);
  console.log('Seeded customers collection with 3 customer records.');

  // 7. Seed separate PAYMENTS collection
  await db.collection('payments').deleteMany({});
  const payments = transactions.map((t) => ({
    vendorId: t.vendorId,
    customerEmail: Object.keys(vendorMap).find(k => vendorMap[k].equals(t.vendorId)) || 'vendor@wedplan.com',
    plan: 'premium',
    amount: t.amount,
    currency: t.currency,
    stripeSessionId: t.stripeSessionId,
    stripePaymentIntentId: t.stripePaymentIntentId,
    paymentMethod: 'card',
    status: t.status,
    billingDetails: {
      name: 'WedPlan Vendor Partner',
      email: Object.keys(vendorMap).find(k => vendorMap[k].equals(t.vendorId)) || 'vendor@wedplan.com',
      address: 'United States',
    },
    receiptUrl: `https://dashboard.stripe.com/test/payments/${t.stripePaymentIntentId}`,
    description: 'WedPlan Premium Vendor Membership (1 Year)',
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  }));
  await db.collection('payments').insertMany(payments);
  console.log('Seeded payments collection with 4 payment records.');

  console.log('MARKETPLACE DATABASE SEED COMPLETE!');
  await mongoose.disconnect();
}

seedCompleteMarketplace().catch(err => {
  console.error('Error seeding marketplace:', err);
  process.exit(1);
});
