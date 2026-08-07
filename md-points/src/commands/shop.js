const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const db = require("../database/connect");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("shop")
    .setDescription("عرض متجر السيرفر"),

  async execute(interaction) {
    await interaction.deferReply();

    const guildId = interaction.guild.id;

    db.all(
      "SELECT * FROM shop_items WHERE guild_id=? AND enabled=1",
      [guildId],
      async (err, items) => {

        if (err) {
          console.error(err);
          return interaction.editReply({
            content: "خطأ في قاعدة البيانات"
          });
        }

        if (!items.length) {
          return interaction.editReply("🛒 المتجر فارغ حالياً");
        }

        let text = "🛒 **متجر السيرفر**\n\n";
        const rows = [];
        let currentRow = new ActionRowBuilder();

        items.forEach((item, index) => {

          text +=
            `📦 **${item.name}**\n` +
            `💰 السعر: ${item.price} 🪙\n` +
            `🎁 النوع: ${item.type}\n\n`;

          currentRow.addComponents(
            new ButtonBuilder()
              .setCustomId(`buy_${item.id}`)
              .setLabel(item.name.length > 20 ? item.name.slice(0, 20) : item.name)
              .setStyle(ButtonStyle.Success)
          );

          if (currentRow.components.length === 5 || index === items.length - 1) {
            rows.push(currentRow);
            currentRow = new ActionRowBuilder();
          }

        });

        await interaction.editReply({
          content: text,
          components: rows
        });

      }
    );
  }
};
