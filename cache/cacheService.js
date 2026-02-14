const Cache = require("../models/Cache");

class DatabaseCache {
  constructor() {
    this.cleanupInterval = null;
    this.startCleanup();
  }

  /**
   * get cache data
   * @param {string} key - cache key
   * @returns {Promise<any|null>} - cached data or null
   */
  async get(key) {
    try {
      const now = new Date();
      const cached = await Cache.findOne({
        where: {
          cacheKey: key,
          expiresAt: {
            [require("sequelize").Op.gt]: now,
          },
        },
      });

      if (cached) {
        console.log(`Cache HIT for key: ${key}`);
        return cached.cacheData;
      }

      console.log(`Cache MISS for key: ${key}`);
      return null;
    } catch (error) {
      console.error("Error getting from cache:", error);
      return null;
    }
  }

  /**
   * set cached data
   * @param {string} key - cache key
   * @param {any} data - data to cache
   * @param {number} ttlSeconds - time to live
   * @returns {Promise<boolean>} - success status
   */
  async set(key, data, ttlSeconds = 30) {
    try {
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

      await Cache.upsert({
        cacheKey: key,
        cacheData: data,
        expiresAt,
      });

      console.log(`Cache SET for key: ${key}, expires in ${ttlSeconds}s`);
      return true;
    } catch (error) {
      console.error("Error setting cache:", error);
      return false;
    }
  }

  /**
   * delete a specific cache entry
   * @param {string} key - cache key
   * @returns {Promise<boolean>} - success status
   */
  async delete(key) {
    try {
      await Cache.destroy({
        where: { cacheKey: key },
      });
      console.log(`Cache DELETE for key: ${key}`);
      return true;
    } catch (error) {
      console.error("Error deleting from cache:", error);
      return false;
    }
  }

  /**
   * clear all expired cache entries
   * @returns {Promise<number>} - number of deleted entries
   */
  async cleanup() {
    try {
      const now = new Date();
      const deletedCount = await Cache.destroy({
        where: {
          expiresAt: {
            [require("sequelize").Op.lt]: now,
          },
        },
      });

      if (deletedCount > 0) {
        console.log(`Cache cleanup: deleted ${deletedCount} expired entries`);
      }
      return deletedCount;
    } catch (error) {
      console.error("Error during cache cleanup:", error);
      return 0;
    }
  }

  /**
   * start automatic cleanup of expired entries
   */
  startCleanup() {
    this.cleanupInterval = setInterval(
      async () => {
        await this.cleanup();
      },
      5 * 60 * 1000,
    );
  }

  /**
   * stop automatic cleanup
   */
  stopCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * get cache stats
   * @returns {Promise<Object>} - cache stats
   */
  async getStats() {
    try {
      const now = new Date();
      const total = await Cache.count();
      const expired = await Cache.count({
        where: {
          expiresAt: {
            [require("sequelize").Op.lt]: now,
          },
        },
      });
      const active = total - expired;

      return {
        total,
        active,
        expired,
        hitRate: "N/A",
      };
    } catch (error) {
      console.error("Error getting cache stats:", error);
      return { total: 0, active: 0, expired: 0, hitRate: "N/A" };
    }
  }
}

// create singleton instance
const cache = new DatabaseCache();

/**
 * cached request wrapper
 * @param {string} key - cache key
 * @param {Function} fn - function to execute if cache miss
 * @param {number} ttlSeconds - cache TTL
 * @returns {Promise<any>} - cached or fresh data
 */
async function cachedRequest(key, fn, ttlSeconds = 30) {
  // try to get cached first
  let data = await cache.get(key);
  if (data !== null) {
    return data;
  }

  // cache miss - execute function and cache result
  try {
    data = await fn();
    await cache.set(key, data, ttlSeconds);
    return data;
  } catch (error) {
    console.error(`Error executing cached function for key ${key}:`, error);
    throw error;
  }
}

module.exports = {
  cache,
  cachedRequest,
};
