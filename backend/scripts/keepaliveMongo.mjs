import mongoose from "mongoose";

const uri = process.env.MONGODB_URI?.trim();

if (!uri) {
  throw new Error("MONGODB_URI is required");
}

try {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  await mongoose.connection.db.admin().command({ ping: 1 });
  console.log("MongoDB ping succeeded");
} finally {
  await mongoose.disconnect();
}
