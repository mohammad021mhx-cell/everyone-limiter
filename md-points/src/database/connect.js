const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: true
  }
});

console.log("✅ تم الاتصال بقاعدة بيانات PostgreSQL");

function convertSQL(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

const db = {

  async exec(sql) {
    return pool.query(sql);
  },

  async run(sql, params = [], callback) {
    try {
      const result = await pool.query(convertSQL(sql), params);
      if (callback) callback(null, result);
      return result;
    } catch (err) {
      if (callback) callback(err);
      else throw err;
    }
  },

  async get(sql, params = [], callback) {
    try {
      const result = await pool.query(convertSQL(sql), params);
      const row = result.rows[0];

      if (callback) callback(null, row);
      return row;

    } catch (err) {
      console.error(err);
      if (callback) callback(err);
      else throw err;
    }
  },

  async all(sql, params = [], callback) {
    try {
      const result = await pool.query(convertSQL(sql), params);

      if (callback) callback(null, result.rows);
      return result.rows;

    } catch (err) {
      console.error(err);
      if (callback) callback(err);
      else throw err;
    }
  }
};

module.exports = db;
