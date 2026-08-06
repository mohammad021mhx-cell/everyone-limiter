const { SlashCommandBuilder } = require("discord.js");
const db = require("../database/connect");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("عرض أعلى الأعضاء بالنقاط"),

  async execute(interaction) {

    await interaction.deferReply();

    const guildId = interaction.guild.id;

    db.all(
      `SELECT user_id, total_points 
       FROM users 
       WHERE guild_id = ?
       ORDER BY total_points DESC
       LIMIT 10`,
      [guildId],
      async (err, rows) => {

        if (err) {
          return interaction.editReply("حدث خطأ في قاعدة البيانات");
        }

        if (!rows.length) {
          return interaction.editReply("لا يوجد أعضاء لديهم نقاط بعد");
        }

        let text = "🏆 **المتصدرون:**\n\n";

        for (let i = 0; i < rows.length; i++) {

          const user = await interaction.guild.members.fetch(rows[i].user_id)
            .catch(() => null);

          text += `${i + 1}. ${user ? user.user.tag : rows[i].user_id} - ⭐ ${rows[i].total_points}\n`;
        }

        interaction.editReply(text);

      }
    );
  }
};
