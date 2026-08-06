const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const db = new sqlite3.Database(
  path.join(__dirname, "../../database/database.db"),
  (err) => {
    if (err) {
      console.error("❌ فشل الاتصال بقاعدة البيانات:", err.message);
    } else {
      console.log("✅ تم الاتصال بقاعدة بيانات SQLite");
    }
  }
);

module.exports = db;
