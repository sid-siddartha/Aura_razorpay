import { PrismaClient } from "@prisma/client";

let prisma;

if (!globalThis.__prisma) {
  globalThis.__prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });
}

prisma = globalThis.__prisma;

export const db = prisma;


// globalThis.prisma: This global variable ensures that the Prisma client instance is
// reused across hot reloads during development. Without this, each time your application
// reloads, a new instance of the Prisma client would be created, potentially leading
// to connection issues.

//In Node.js, process.env is an object that stores all environment variables.

// process.env.NODE_ENV != "production"
// This checks if your app is NOT in production mode.
// If NODE_ENV is "development" → ✅ condition is true.
// If NODE_ENV is "test" → ✅ condition is true.
// If NODE_ENV is "production" → ❌ condition is false.

//This statement
// if(process.env.NODE_ENV != "production"){
//     globalThis.prisma = db;
// }
// When developing locally (not production):
// It stores db in globalThis.prisma to reuse the Prisma instance across hot reloads.
// When in production:
// Hot reloads don’t happen, so this line is skipped, and a fresh Prisma client is created during app startup (which is safer for scaling and serverless functions).





