const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(
  path.join(__dirname, "../../database/database.db")
);

console.log("✅ تم الاتصال بقاعدة بيانات SQLite");

module.exports = db;
