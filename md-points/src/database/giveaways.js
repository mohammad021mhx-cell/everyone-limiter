const db = require("./connect");

db.serialize(() => {

  db.run(`
    CREATE TABLE IF NOT EXISTS giveaways (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      name TEXT NOT NULL,
      prize TEXT NOT NULL,
      winners_count INTEGER NOT NULL,
      role_id TEXT,
      channel_id TEXT NOT NULL,
      type TEXT NOT NULL,
      entry_fee INTEGER DEFAULT 0,
      run_at INTEGER NOT NULL,
      status TEXT DEFAULT 'active',
      message_id TEXT,
      created_by TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS giveaway_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      giveaway_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      joined_at INTEGER NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS giveaway_winners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      giveaway_id INTEGER NOT NULL,
      user_id TEXT NOT NULL
    )
  `);

  console.log("✅ تم إنشاء جداول السحوبات");

});

db.run(`
CREATE TABLE IF NOT EXISTS giveaway_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  giveaway_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  paid INTEGER DEFAULT 0,
  UNIQUE(giveaway_id,user_id)
)
`);

console.log("✅ تم تجهيز جدول مشاركين السحوبات");
