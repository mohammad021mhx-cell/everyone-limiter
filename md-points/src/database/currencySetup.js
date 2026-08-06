const db = require("./connect");

const stmt = db.prepare(`
  INSERT OR IGNORE INTO currencies
  (guild_id, name, symbol)
  VALUES (?, ?, ?)
`);

stmt.run(
  "1501492672781877339",
  "Coins",
  "🪙"
);

console.log("✅ تم تجهيز العملة الافتراضية");

module.exports = db;
