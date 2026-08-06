const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const db = require("../database/connect");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("shop")
    .setDescription("عرض متجر السيرفر"),

  async execute(interaction) {

    const guildId = interaction.guild.id;

    db.all(
      "SELECT * FROM shop_items WHERE guild_id=? AND enabled=1",
      [guildId],
      async (err, items) => {

        if (err) {
          return interaction.reply({
            content: "خطأ في قاعدة البيانات",
            ephemeral: true
          });
        }

        if (!items.length) {
          return interaction.reply("🛒 المتجر فارغ حالياً");
        }

        let text = "🛒 **متجر السيرفر**\n\n";
        const rows = [];

        items.forEach(item => {

          text +=
          `📦 **${item.name}**\n` +
          `💰 السعر: ${item.price} 🪙\n` +
          `🎁 النوع: ${item.type}\n\n`;

          rows.push(
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`buy_${item.id}`)
                .setLabel(`شراء ${item.name}`)
                .setStyle(ButtonStyle.Success)
            )
          );

        });

        interaction.reply({
          content: text,
          components: rows
        });

      }
    );
  }
};
