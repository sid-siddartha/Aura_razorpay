// Prisma 6 skips .env loading when this file exists.
// We load dotenv explicitly so DATABASE_URL is available to Prisma.
require("dotenv").config();

module.exports = {};
