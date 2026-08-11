const db = require("../database/connect");

module.exports = {
  name: "messageCreate",

  async execute(message) {
    if (message.author.bot) return;
    if (!message.guild) return;

    const guildId = message.guild.id;
    const userId = message.author.id;

    db.get(
      "SELECT * FROM settings WHERE guild_id = ?",
      [guildId],
      (err, settings) => {
        if (err) {
          console.error("❌ SETTINGS ERROR:", err);
          return;
        }

        const points = settings?.text_points || 1;
        const minLength = settings?.min_message_length || 10;
        const required = settings?.messages_required || 1;

        if (message.content.length < minLength) return;

        db.get(
          "SELECT * FROM users WHERE guild_id = ? AND user_id = ?",
          [guildId, userId],
          (err, user) => {
            if (err) {
              console.error("❌ USER SELECT ERROR:", err);
              return;
            }

            if (!user) {
              return db.run(
                `INSERT INTO users
                 (guild_id, user_id, message_count)
                 VALUES (?, ?, 0)`,
                [guildId, userId]
              );
            }

            const count = Number(user.message_count || 0) + 1;

            console.log(
              `[POINTS] ${message.author.tag}: ${count}/${required}`
            );

            if (count >= required) {
              db.run(
                `UPDATE users
                 SET text_points = text_points + ?,
                     total_points = total_points + ?,
                     message_count = 0
                 WHERE guild_id = ? AND user_id = ?`,
                [points, points, guildId, userId],
                err => {
                  if (err) {
                    console.error("❌ POINT UPDATE ERROR:", err);
                    return;
                  }

                  console.log(
                    `[POINTS] ${message.author.tag}: +${points} نقطة`
                  );
                }
              );
            } else {
              db.run(
                `UPDATE users
                 SET message_count = ?
                 WHERE guild_id = ? AND user_id = ?`,
                [count, guildId, userId],
                err => {
                  if (err) {
                    console.error("❌ COUNT UPDATE ERROR:", err);
                  }
                }
              );
            }
          }
        );
      }
    );
  }
};
