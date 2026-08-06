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

    const staffCount = await new Promise((resolve) => {
      db.get(
        "SELECT COUNT(*) AS count FROM staff WHERE guild_id=?",
        [guildId],
        (err, row) => {
          if (err) return resolve(0);
          resolve(row.count);
        }
      );
    });

    if (staffCount > 0) {
      if (!(await checkStaffPermission(interaction))) return;
    }

    const member = interaction.options.getUser("member");

    db.run(
      "INSERT OR IGNORE INTO staff (guild_id,user_id) VALUES (?,?)",
      [guildId, member.id],
      function (err) {

        if (err) {
          return interaction.reply({
            content: "❌ حدث خطأ أثناء إضافة الموظف.",
            ephemeral: true
          });
        }

        interaction.reply({
          content: `✅ تم إضافة ${member} إلى الموظفين.`,
          ephemeral: true
        });

      }
    );
  }
};
