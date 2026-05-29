const knex = require('knex');
const config = require('../../knexfile');
const logger = require('../utils/logger');

const environment = process.env.NODE_ENV || 'development';
const db = knex(config[environment]);

async function connectDB() {
  try {
    await db.raw('SELECT 1');
    logger.info('Database connection established successfully');
  } catch (error) {
    logger.error('Database connection failed:', error);
    throw error;
  }
}

async function disconnectDB() {
  try {
    await db.destroy();
    logger.info('Database connection closed');
  } catch (error) {
    logger.error('Error closing database connection:', error);
    throw error;
  }
}

module.exports = {
  db,
  connectDB,
  disconnectDB
};
