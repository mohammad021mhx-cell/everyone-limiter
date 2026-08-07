const db = require("../database/connect");

const timers = new Map();

module.exports = {
  name: "voiceStateUpdate",

  execute(oldState, newState) {
    const member = newState.member || oldState.member;

    if (!member || member.user.bot) return;

    const guildId = member.guild.id;
    const userId = member.id;

    if (!oldState.channel && newState.channel) {

      if (timers.has(userId)) return;

      db.get(
        "SELECT * FROM settings WHERE guild_id=?",
        [guildId],
        (err, settings) => {
          if (err || !settings) return;

          if (!settings.voice_enabled) return;

          const intervalTime = (settings.voice_interval || 10) * 60 * 1000;

          const timer = setInterval(() => {

            db.get(
              "SELECT * FROM settings WHERE guild_id=?",
              [guildId],
              (err, current) => {

                if (err || !current) return;

                if (!current.voice_enabled) return;

                const points = current.voice_points || 1;

                db.run(
                  `INSERT INTO users
                  (guild_id,user_id,voice_points,total_points,last_voice)
                  VALUES (?,?,?,?,?)
                  ON CONFLICT(guild_id,user_id)
                  DO UPDATE SET
                  voice_points=voice_points+?,
                  total_points=total_points+?,
                  last_voice=?`,
                  [
                    guildId,
                    userId,
                    points,
                    points,
                    Date.now(),
                    points,
                    points,
                    Date.now()
                  ]
                );

              }
            );

          }, intervalTime);

          timers.set(userId, timer);

        }
      );
    }


    if (oldState.channel && !newState.channel) {

      if (timers.has(userId)) {
        clearInterval(timers.get(userId));
        timers.delete(userId);
      }

    }
  }
};
