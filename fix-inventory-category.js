// Fix inventory items with 'EPC Equipment' category
const mongoose = require('mongoose');
const { InventoryItem } = require('./models/inventory');

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('Set MONGODB_URI (see backend-services/.env.example).');
  process.exit(1);
}

async function fixInventoryCategories() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Find all items with EPC Equipment category
    const items = await InventoryItem.find({ category: 'EPC Equipment' });
    console.log(`Found ${items.length} items with 'EPC Equipment' category`);
    
    // Update them to a valid category - let's use 'Other' as a fallback
    // or you can specify which category it should be
    for (const item of items) {
      console.log(`Updating item ${item._id} (${item.equipmentType || item.model})`);
      item.category = 'Other'; // or whatever the appropriate category should be
      await item.save();
    }
    
    console.log(`✅ Fixed ${items.length} inventory items`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixInventoryCategories();

