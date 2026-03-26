const mongoose = require('mongoose');

// ---------------------------------------------------------------------------
// Serverless-safe MongoDB connection with caching.
//
// Vercel reuses warm Lambda instances between requests. Without caching,
// each warm request would open a new connection, exhausting Atlas limits.
// global._mongoConnection persists across invocations on the same instance.
// ---------------------------------------------------------------------------
let cached = global._mongoConnection;
if (!cached) {
  cached = global._mongoConnection = { conn: null, promise: null };
}

const connectDB = async () => {
  // Already connected — reuse it
  if (cached.conn) {
    return cached.conn;
  }

  // Connection attempt in progress — wait for it
  if (!cached.promise) {
    const opts = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000, // Fail fast if Atlas unreachable
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
    };

    cached.promise = mongoose
      .connect(process.env.MONGO_URI, opts)
      .then((conn) => {
        console.log(`✓ MongoDB Connected: ${conn.connection.host}`);
        return conn;
      })
      .catch((error) => {
        // Reset so the next cold start retries rather than reusing a failed promise
        cached.promise = null;
        console.error(`✗ MongoDB connection error: ${error.message}`);
        // Do NOT call process.exit — let individual requests fail gracefully
        throw error;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    cached.promise = null;
    throw error;
  }

  return cached.conn;
};

module.exports = connectDB;
