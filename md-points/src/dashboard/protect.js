const db = require("../database/connect");

module.exports = async function(req, res, next) {

  if (!req.session.userId) {
    return res.status(403).send("❌ غير مسجل دخول");
  }

  const userId = req.session.userId;
  const guildId = req.params.guildId;

  try {

    const guild = req.app.get("client")?.guilds.cache.get(guildId);

    if (guild && guild.ownerId === userId) {
      return next();
    }

    db.get(
      "SELECT * FROM staff WHERE guild_id=? AND user_id=?",
      [guildId, userId],
      (err, staff) => {

        if (staff) return next();

        return res.status(403).send("❌ ليس لديك صلاحية");
      }
    );

  } catch (err) {
    console.error(err);
    return res.status(500).send("خطأ");
  }
};
