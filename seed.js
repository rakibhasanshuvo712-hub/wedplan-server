require('dotenv').config();
const { connectDB, disconnectDB } = require('./src/config/db');
const { seedDatabase } = require('./src/utils/seed');

async function main() {
  await connectDB();
  await seedDatabase();
  await disconnectDB();
  console.log('SEED_SCRIPT_COMPLETED_SUCCESSFULLY');
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed script failed:', err);
  process.exit(1);
});
