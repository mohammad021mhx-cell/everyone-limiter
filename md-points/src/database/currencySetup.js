const db = require("./connect");

db.serialize(() => {
  db.run(`
    INSERT OR IGNORE INTO currencies
    (guild_id, name, symbol)
    VALUES (?, ?, ?)
  `, [
    "1501492672781877339",
    "Coins",
    "🪙"
  ]);

  console.log("✅ تم تجهيز العملة الافتراضية");
});
