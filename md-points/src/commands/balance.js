const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const db = require("../database/connect");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("balance")
    .setDescription("عرض رصيدك"),

  async execute(interaction) {
    console.log("START balance", interaction.user.id);

    try {
      const guildId = interaction.guild.id;
      const userId = interaction.user.id;

      const user = await db.get(
        "SELECT * FROM users WHERE guild_id=? AND user_id=?",
        [guildId, userId]
      );

      if (!user) {
        return await interaction.reply({
          content: "ليس لديك رصيد بعد",
          flags: MessageFlags.Ephemeral
        });
      }

      const currency = await db.get(
        "SELECT * FROM currencies WHERE guild_id=? AND enabled=1 LIMIT 1",
        [guildId]
      );

      const name = currency?.name || "Points";
      const symbol = currency?.symbol || "⭐";

      await interaction.reply({
        content:
`${symbol} رصيدك: ${user.total_points} ${name}

📝 من الرسائل: ${user.text_points}
🎙️ من الصوت: ${user.voice_points}`,
        flags: MessageFlags.Ephemeral
      });

    } catch (error) {
      console.error("BALANCE ERROR:", error);

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "حدث خطأ أثناء عرض الرصيد",
          flags: MessageFlags.Ephemeral
        }).catch(() => {});
      }
    }
  }
};
