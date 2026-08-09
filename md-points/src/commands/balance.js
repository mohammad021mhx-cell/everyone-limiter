const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const db = require("../database/connect");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("balance")
    .setDescription("عرض رصيدك"),

  async execute(interaction) {
    console.log("START balance", interaction.user.id);

    try {
      await interaction.deferReply();

      const guildId = interaction.guild.id;
      const userId = interaction.user.id;

      const user = await db.get(
        "SELECT * FROM users WHERE guild_id=? AND user_id=?",
        [guildId, userId]
      );

      if (!user) {
        return interaction.editReply("ليس لديك رصيد بعد");
      }

      const currency = await db.get(
        "SELECT * FROM currencies WHERE guild_id=? AND enabled=1 LIMIT 1",
        [guildId]
      );

      const name = currency?.name || "Points";
      const symbol = currency?.symbol || "⭐";

      await interaction.editReply(
`${symbol} رصيدك: ${user.total_points} ${name}

📝 من الرسائل: ${user.text_points}
🎙️ من الصوت: ${user.voice_points}`
      );

    } catch (error) {
      console.error("BALANCE ERROR:", error);

      if (interaction.deferred && !interaction.replied) {
        await interaction.editReply("حدث خطأ أثناء عرض الرصيد").catch(() => {});
      }
    }
  }
};
