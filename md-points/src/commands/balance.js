const { SlashCommandBuilder } = require("discord.js");
const db = require("../database/connect");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("balance")
    .setDescription("عرض رصيدك"),

  async execute(interaction) {
    console.log("START", interaction.commandName, interaction.user.id);
    await interaction.deferReply();
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    db.get(
      "SELECT * FROM users WHERE guild_id=? AND user_id=?",
      [guildId, userId],
      (err, user) => {
        if (err) { console.error(err);
          return interaction.editReply({
            content: "خطأ في قاعدة البيانات",
            ephemeral: true
          });
        }

        if (!user) {
          return interaction.editReply("ليس لديك رصيد بعد");
        }

        db.get(
          "SELECT * FROM currencies WHERE guild_id=? AND enabled=1 LIMIT 1",
          [guildId],
          (err, currency) => {

            const name = currency?.name || "Points";
            const symbol = currency?.symbol || "⭐";

            interaction.editReply(
`${symbol} رصيدك: ${user.total_points} ${name}

📝 من الرسائل: ${user.text_points}
🎙️ من الصوت: ${user.voice_points}`
            );

          }
        );
      }
    );
  }
};
