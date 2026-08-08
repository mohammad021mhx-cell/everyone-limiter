const { SlashCommandBuilder } = require("discord.js");
const db = require("../database/connect");
const checkStaffPermission = require("../utils/checkStaffPermission");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("staff-add")
    .setDescription("إضافة موظف")
    .addUserOption(option =>
      option
        .setName("member")
        .setDescription("العضو")
        .setRequired(true)
    ),

  async execute(interaction) {

    const guildId = interaction.guild.id;

    const row = await db.get(
      "SELECT COUNT(*) AS count FROM staff WHERE guild_id=?",
      [guildId]
    );

    const staffCount = Number(row?.count || 0);

    if (staffCount > 0) {
      if (!(await checkStaffPermission(interaction))) return;
    }

    const member = interaction.options.getUser("member");

    try {
      await db.run(
        "INSERT INTO staff (guild_id,user_id) VALUES (?,?) ON CONFLICT (guild_id,user_id) DO NOTHING",
        [guildId, member.id]
      );

      await interaction.reply({
        content: `✅ تم إضافة ${member} إلى الموظفين.`,
        ephemeral: true
      });

    } catch (err) {
      console.error(err);

      await interaction.reply({
        content: "❌ حدث خطأ أثناء إضافة الموظف.",
        ephemeral: true
      });
    }
  }
};
