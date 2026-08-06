const db = require("./connect");

db.exec(`
  CREATE TABLE IF NOT EXISTS shop_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    name TEXT NOT NULL,
    price INTEGER DEFAULT 0,
    type TEXT DEFAULT 'text',
    value TEXT,
    enabled INTEGER DEFAULT 1
  )
`);

console.log("✅ تم إنشاء جدول المتجر");

module.exports = db;
