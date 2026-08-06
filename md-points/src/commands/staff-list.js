const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const db = require("../database/connect");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("staff-list")
    .setDescription("عرض موظفي المتجر")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    db.all(
      "SELECT user_id FROM staff WHERE guild_id=?",
      [interaction.guild.id],
      (err, rows) => {

        if (err) {
          return interaction.reply({
            content: "❌ خطأ في قاعدة البيانات",
            ephemeral: true
          });
        }

        if (!rows.length) {
          return interaction.reply({
            content: "❌ لا يوجد موظفون",
            ephemeral: true
          });
        }

        const list = rows.map(r => `• <@${r.user_id}>`).join("\n");

        interaction.reply({
          content: `👥 **موظفو المتجر:**\n\n${list}`,
          ephemeral: true
        });
      }
    );
  }
};
