const db = require("./connect");

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      guild_id TEXT PRIMARY KEY,
      text_enabled INTEGER DEFAULT 1,
      voice_enabled INTEGER DEFAULT 1,
      text_points INTEGER DEFAULT 1,
      voice_points INTEGER DEFAULT 1,
      voice_interval INTEGER DEFAULT 600,
      message_cooldown INTEGER DEFAULT 60,
      min_message_length INTEGER DEFAULT 10
    )
  `);

  console.log("✅ تم إنشاء جدول settings");
});

module.exports = db;
