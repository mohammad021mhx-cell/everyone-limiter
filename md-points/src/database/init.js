const db = require("./connect");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    text_points INTEGER DEFAULT 0,
    voice_points INTEGER DEFAULT 0,
    total_points INTEGER DEFAULT 0,
    last_message INTEGER DEFAULT 0,
    last_voice INTEGER DEFAULT 0,
    UNIQUE(guild_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    UNIQUE(guild_id, user_id)
  );
`);

console.log("✅ تم إنشاء جداول قاعدة البيانات");

module.exports = db;
