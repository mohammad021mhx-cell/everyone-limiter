const db = require("./connect");

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS currencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      name TEXT NOT NULL,
      symbol TEXT,
      earn_from_text INTEGER DEFAULT 1,
      earn_from_voice INTEGER DEFAULT 1,
      enabled INTEGER DEFAULT 1,
      UNIQUE(guild_id, name)
    )
  `);

  console.log("✅ تم إنشاء جدول currencies");
});

module.exports = db;
