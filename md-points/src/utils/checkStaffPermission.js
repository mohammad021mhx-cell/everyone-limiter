const db = require("../database/connect");
const isStaff = require("./checkStaff");
const { PermissionFlagsBits } = require("discord.js");

module.exports = async function checkStaffPermission(interaction) {
  const guildId = interaction.guild.id;
  const userId = interaction.user.id;

  // مالك السيرفر له صلاحية كاملة دائماً
  if (interaction.guild.ownerId === userId) {
    return true;
  }

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

  // إذا ما فيه موظفين، أول Administrator يقدر يضيف أول موظف
  if (staffCount === 0) {
    if (interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return true;
    }

    await interaction.reply({
      content: "❌ يجب على أول Administrator إضافة أول موظف.",
      ephemeral: true
    });

    return false;
  }

  // السماح للموظفين
  if (await isStaff(guildId, userId)) {
    return true;
  }

  await interaction.reply({
    content: "❌ ليس لديك صلاحية.",
    ephemeral: true
  });

  return false;
};
