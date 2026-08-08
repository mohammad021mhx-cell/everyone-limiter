const Database = require("better-sqlite3");
const path = require("path");

const sqlite = new Database(
  path.join(__dirname, "../../database/database.db")
);

console.log("✅ تم الاتصال بقاعدة بيانات SQLite");

const db = {
  prepare(sql) {
    return sqlite.prepare(sql);
  },
  exec(sql) {
    return sqlite.exec(sql);
  },
  run(sql, params = [], callback) {
    try {
      const result = sqlite.prepare(sql).run(...params);
      if (callback) callback(null, result);
      return result;
    } catch (err) {
      if (callback) callback(err);
      else throw err;
    }
  },

  get(sql, params = [], callback) {
    try {
      const result = sqlite.prepare(sql).get(...params);
      if (callback) callback(null, result);
      return result;
    } catch (err) {
      if (callback) callback(err);
      else throw err;
    }
  },

  all(sql, params = [], callback) {
    try {
      const result = sqlite.prepare(sql).all(...params);
      if (callback) callback(null, result);
      return result;
    } catch (err) {
      if (callback) callback(err);
      else throw err;
    }
  }
};

module.exports = db;
