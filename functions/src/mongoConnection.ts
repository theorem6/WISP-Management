// MongoDB Connection Handler for Firebase Functions
// Uses official MongoDB Node.js Driver v6.x
// Reference: https://www.mongodb.com/docs/drivers/node/current/

import { MongoClient, Db } from 'mongodb';

// Singleton MongoDB client for Firebase Functions
let mongoClient: MongoClient | null = null;
let mongoDb: Db | null = null;

/**
 * Get MongoDB connection string from environment variables
 * Falls back to hardcoded connection string if not set
 */
function getMongoConnectionString(): string {
  // Check multiple environment variable names for compatibility
  const connectionString =
    process.env.MONGODB_URI ||
    process.env.MONGODB_CONNECTION_URL ||
    // Atlas template (wisptools.io / Cluster0) — set MONGODB_URI in production; replace <db_password> with real password
    'mongodb+srv://genieacs-user:<db_password>@cluster0.1radgkw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

  return connectionString;
}

/**
 * Get database name from environment or use default
 */
function getDatabaseName(): string {
  return process.env.MONGODB_DATABASE || 'genieacs';
}

/**
 * Initialize MongoDB connection (singleton pattern for Firebase Functions)
 * This ensures we reuse the same connection across function invocations
 */
export async function getMongoClient(): Promise<MongoClient> {
  if (!mongoClient) {
    const connectionString = getMongoConnectionString();
    
    // Validate connection string
    if (connectionString.includes('<db_password>')) {
      throw new Error(
        'MongoDB connection string contains placeholder password. ' +
        'Please set MONGODB_URI environment variable or update the connection string.'
      );
    }

    console.log('🔌 Initializing MongoDB connection...');
    
    // Create new MongoDB client with recommended options
    mongoClient = new MongoClient(connectionString, {
      // Connection pool settings for Firebase Functions
      maxPoolSize: 10,
      minPoolSize: 2,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 10000,
      // Compression for better performance
      compressors: ['zlib'],
    });

    // Connect to MongoDB
    await mongoClient.connect();
    console.log('✅ MongoDB connected successfully');

    // Verify connection by pinging the database
    await mongoClient.db('admin').command({ ping: 1 });
    console.log('✅ MongoDB ping successful');
  }

  return mongoClient;
}

/**
 * Get MongoDB database instance
 */
export async function getMongoDb(): Promise<Db> {
  if (!mongoDb) {
    const client = await getMongoClient();
    const dbName = getDatabaseName();
    mongoDb = client.db(dbName);
    console.log(`✅ Connected to database: ${dbName}`);
  }

  return mongoDb;
}

/**
 * Get MongoDB collections for GenieACS
 */
export async function getGenieACSCollections() {
  const db = await getMongoDb();

  return {
    devices: db.collection('devices'),
    tasks: db.collection('tasks'),
    faults: db.collection('faults'),
    presets: db.collection('presets'),
    provisions: db.collection('provisions'),
    operations: db.collection('operations'),
    files: db.collection('fs.files'), // GridFS files
    chunks: db.collection('fs.chunks'), // GridFS chunks
  };
}

/**
 * Close MongoDB connection (usually not needed in Firebase Functions)
 * Firebase Functions typically keep connections alive between invocations
 */
export async function closeMongoConnection(): Promise<void> {
  if (mongoClient) {
    await mongoClient.close();
    mongoClient = null;
    mongoDb = null;
    console.log('🔌 MongoDB connection closed');
  }
}

/**
 * Check if MongoDB connection is healthy
 */
export async function isMongoConnected(): Promise<boolean> {
  try {
    if (!mongoClient) return false;
    const client = await getMongoClient();
    await client.db('admin').command({ ping: 1 });
    return true;
  } catch (error) {
    console.error('❌ MongoDB connection check failed:', error);
    return false;
  }
}

/**
 * Get connection statistics
 */
export async function getConnectionStats() {
  try {
    // Ensure MongoDB client is connected
    await getMongoClient();
    const db = await getMongoDb();
    
    // Get server info
    const serverInfo = await db.admin().serverInfo();
    
    // Get database stats
    const dbStats = await db.stats();

    return {
      connected: true,
      serverVersion: serverInfo.version,
      databaseName: db.databaseName,
      collections: dbStats.collections,
      dataSize: dbStats.dataSize,
      storageSize: dbStats.storageSize,
      indexes: dbStats.indexes,
    };
  } catch (error) {
    console.error('❌ Failed to get connection stats:', error);
    return {
      connected: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

