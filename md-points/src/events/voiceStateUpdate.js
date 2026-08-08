const db = require("../database/connect");

const timers = new Map();

async function startVoiceTimer(member) {
  if (!member || member.user.bot) return;

  const guildId = member.guild.id;
  const userId = member.id;
  const timerKey = `${guildId}:${userId}`;

  if (timers.has(timerKey)) return;

  try {
    const settings = await db.get(
      "SELECT voice_enabled, voice_points, voice_interval FROM settings WHERE guild_id=?",
      [guildId]
    );

    if (!settings || !settings.voice_enabled) return;

    const intervalMinutes = Number(settings.voice_interval);

    if (!intervalMinutes || intervalMinutes <= 0) {
      console.log(
        "VOICE INVALID INTERVAL",
        guildId,
        settings.voice_interval
      );
      return;
    }

    const intervalTime = intervalMinutes * 60 * 1000;

    console.log(
      "VOICE TIMER RUNNING",
      userId,
      `EVERY ${intervalMinutes} MIN`
    );

    const timer = setInterval(async () => {
      try {
        const current = await db.get(
          "SELECT voice_enabled, voice_points, voice_interval FROM settings WHERE guild_id=?",
          [guildId]
        );

        if (!current || !current.voice_enabled) {
          clearInterval(timer);
          timers.delete(timerKey);

          console.log("VOICE TIMER STOPPED", userId);
          return;
        }

        // إذا تغيرت مدة الصوت من الداشبورد
        const newIntervalMinutes = Number(current.voice_interval);

        if (
          !newIntervalMinutes ||
          newIntervalMinutes <= 0
        ) {
          clearInterval(timer);
          timers.delete(timerKey);

          console.log("VOICE TIMER STOPPED INVALID INTERVAL", userId);
          return;
        }

        if (newIntervalMinutes !== intervalMinutes) {
          clearInterval(timer);
          timers.delete(timerKey);

          console.log(
            "VOICE INTERVAL CHANGED",
            userId,
            `${intervalMinutes} -> ${newIntervalMinutes} MIN`
          );

          const currentMember =
            member.guild.members.cache.get(userId);

          if (currentMember && currentMember.voice.channel) {
            startVoiceTimer(currentMember);
          }

          return;
        }

        // نعتمد على الكاش بدل members.fetch()
        const currentMember =
          member.guild.members.cache.get(userId);

        // نتأكد أن العضو ما زال داخل روم صوتي
        if (!currentMember || !currentMember.voice.channel) {
          clearInterval(timer);
          timers.delete(timerKey);

          console.log("VOICE TIMER STOPPED", userId);
          return;
        }

        const points = Number(current.voice_points || 1);

        await db.run(
          `INSERT INTO users
          (guild_id, user_id, voice_points, total_points, last_voice)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT (guild_id, user_id)
          DO UPDATE SET
            voice_points = users.voice_points + EXCLUDED.voice_points,
            total_points = users.total_points + EXCLUDED.total_points,
            last_voice = EXCLUDED.last_voice`,
          [
            guildId,
            userId,
            points,
            points,
            Date.now()
          ]
        );

        console.log(
          "VOICE POINT ADDED",
          userId,
          points
        );

      } catch (err) {
        console.error("VOICE DB ERROR:", err);
      }
    }, intervalTime);

    timers.set(timerKey, timer);

  } catch (err) {
    console.error("VOICE START ERROR:", err);
  }
}

function stopVoiceTimer(member) {
  if (!member) return;

  const guildId = member.guild.id;
  const userId = member.id;
  const timerKey = `${guildId}:${userId}`;

  if (timers.has(timerKey)) {
    clearInterval(timers.get(timerKey));
    timers.delete(timerKey);

    console.log("VOICE TIMER STOPPED", userId);
  }
}

module.exports = {
  name: "voiceStateUpdate",

  startVoiceTimer,

  execute(oldState, newState) {
    const member = newState.member || oldState.member;

    if (!member || member.user.bot) return;

    // العضو دخل روم صوتي
    if (newState.channel && !oldState.channel) {
      console.log(
        "🎙️ VOICE JOIN:",
        member.id,
        "CHANNEL:",
        newState.channel.id
      );

      startVoiceTimer(member);
      return;
    }

    // العضو خرج من الروم
    if (!newState.channel && oldState.channel) {
      console.log(
        "🎙️ VOICE LEAVE:",
        member.id
      );

      stopVoiceTimer(member);
      return;
    }

    // انتقل من روم إلى روم
    if (
      oldState.channel &&
      newState.channel &&
      oldState.channel.id !== newState.channel.id
    ) {
      console.log(
        "🎙️ VOICE MOVE:",
        member.id,
        "CHANNEL:",
        newState.channel.id
      );

      stopVoiceTimer(member);
      startVoiceTimer(member);
    }
  }
};
