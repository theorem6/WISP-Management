/**
 * Clear old update commands with incorrect hashes
 * This allows new commands to be generated with correct hashes from the manifest
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('Set MONGODB_URI in environment or backend-services/.env (see .env.example).');
  process.exit(1);
}

const { EPCCommand } = require('../models/distributed-epc-schema');

async function main() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const epcId = process.argv[2] || 'EPC-CB4C5042';
    console.log(`\nClearing old update commands for EPC: ${epcId}\n`);

    // Find and delete old update commands that have wrong hashes or are failed/pending
    const result = await EPCCommand.deleteMany({
      epc_id: epcId,
      command_type: 'script_execution',
      status: { $in: ['pending', 'sent', 'failed'] },
      script_content: { $regex: 'Auto-generated update script' }
    });

    console.log(`✅ Deleted ${result.deletedCount} old update command(s)`);
    console.log('\nNext check-in will generate new commands with correct hashes from the manifest.');

    await mongoose.disconnect();
    console.log('\nDone.');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
    await mongoose.disconnect();
    process.exit(1);
  }
}

main();

