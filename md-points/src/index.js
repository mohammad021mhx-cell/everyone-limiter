require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { 
  Client, 
  GatewayIntentBits, 
  Collection,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

require("./database/connect");
require("./database/init");
require("./database/currencies");
require("./database/settings");
require("./database/shop");
require("./database/giveaways");

const messageCreate = require("./events/messageCreate");
const voiceStateUpdate = require("./events/voiceStateUpdate");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, "commands");

if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));

  for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.data.name, command);
  }
}

client.once("clientReady", () => {
  console.log(`🤖 تم تسجيل الدخول باسم ${client.user.tag}`);
});

client.on(messageCreate.name, (...args) => messageCreate.execute(...args));
client.on(voiceStateUpdate.name, (...args) => voiceStateUpdate.execute(...args));

client.on("interactionCreate", async interaction => {

  if (interaction.isButton()) {

    if (interaction.customId.startsWith("join_giveaway_")) {

      const db = require("./database/connect");

      const giveawayId = interaction.customId.split("_")[2];
      console.log("GIVEAWAY BUTTON:", interaction.customId, "ID:", giveawayId);

      db.run(
        "INSERT OR IGNORE INTO giveaway_entries (giveaway_id,user_id,joined_at) VALUES (?,?,?)",
        [giveawayId, interaction.user.id, Date.now()],
        function(err){

          if(err){
            return interaction.reply({
              content:"❌ حدث خطأ",
              ephemeral:true
            });
          }

          if(this.changes === 0){
            return interaction.reply({
              content:"⚠️ أنت مشارك مسبقًا",
              ephemeral:true
            });
          }

          interaction.reply({
            content:"🎉 تم تسجيل مشاركتك في السحب",
            ephemeral:true
          });

        }
      );

      return;
    }

    if (interaction.customId.startsWith("buy_")) {

      const itemId = interaction.customId.split("_")[1];
      const db = require("./database/connect");

      const guildId = interaction.guild.id;
      const userId = interaction.user.id;

      db.get(
        "SELECT * FROM shop_items WHERE id=? AND guild_id=?",
        [itemId, guildId],
        (err, item) => {

          if (!item) {
            return interaction.reply({
              content: "❌ المنتج غير موجود",
              ephemeral: true
            });
          }

          if (item.stock === 0) {
            return interaction.reply({
              content: "❌ نفذت الكمية",
              ephemeral: true
            });
          }

          if (item.requires_input) {

            const modal = new ModalBuilder()
              .setCustomId(`buy_input_${item.id}`)
              .setTitle(`شراء ${item.name}`);

            const input = new TextInputBuilder()
              .setCustomId("user_input")
              .setLabel(item.input_name || "المعلومات المطلوبة")
              .setStyle(TextInputStyle.Short)
              .setRequired(true);

            const row = new ActionRowBuilder()
              .addComponents(input);

            modal.addComponents(row);

            return interaction.showModal(modal);
          }

          db.get(
            "SELECT * FROM users WHERE guild_id=? AND user_id=?",
            [guildId, userId],
            (err, user) => {

              if (!user || user.total_points < item.price) {
                return interaction.reply({
                  content: "❌ رصيدك لا يكفي",
                  ephemeral: true
                });
              }

              db.run(
                "UPDATE users SET total_points=total_points-? WHERE guild_id=? AND user_id=? AND total_points>=?",
                [item.price, guildId, userId, item.price],
                ()=>{
                  if(item.stock > 0){
                    db.run(
                      "UPDATE shop_items SET stock=stock-1 WHERE id=?",
                      [item.id]
                    );
                  }
                }
              );

              interaction.reply({
                content: `✅ تم شراء ${item.name}`,
                ephemeral: true
              });

            }
          );

        }
      );
    }

    if (interaction.customId.startsWith("deliver_")) {

      if (!interaction.member.permissions.has("Administrator"))
        return interaction.reply({content:"❌ ليس لديك صلاحية",ephemeral:true});

      await interaction.update({
        content: interaction.message.content + "\n\n✅ **تم التسليم**",
        components:[]
      });

      return;
    }

    if (interaction.customId.startsWith("reject_")) {

      if (!interaction.member.permissions.has("Administrator"))
        return interaction.reply({content:"❌ ليس لديك صلاحية",ephemeral:true});

      const db=require("./database/connect");

      const data=interaction.customId.split("_");
      const userId=data[1];
      const price=parseInt(data[3]);

      db.run(
        "UPDATE users SET total_points=total_points+? WHERE guild_id=? AND user_id=?",
        [price,interaction.guild.id,userId]
      );

      await interaction.update({
        content: interaction.message.content + "\n\n❌ **تم رفض الطلب وإرجاع النقاط**",
        components:[]
      });

      interaction.guild.members.fetch(userId).then(member=>{
        member.send("❌ تم رفض طلبك وتمت إعادة نقاطك.").catch(()=>{});
      }).catch(()=>{});

      return;
    }

    return;
  }


  if (interaction.isModalSubmit()) {

    if (interaction.customId.startsWith("buy_input_")) {

      const db = require("./database/connect");

      const itemId = interaction.customId.split("_")[2];
      const guildId = interaction.guild.id;
      const userId = interaction.user.id;
      const userInput = interaction.fields.getTextInputValue("user_input");

      db.get(
        "SELECT * FROM shop_items WHERE id=? AND guild_id=?",
        [itemId, guildId],
        (err, item) => {

          if (!item) {
            return interaction.reply({
              content: "❌ المنتج غير موجود",
              ephemeral: true
            });
          }

          if (item.stock === 0) {
            return interaction.reply({
              content: "❌ نفذت الكمية",
              ephemeral: true
            });
          }

          db.run(
            "UPDATE users SET total_points=total_points-? WHERE guild_id=? AND user_id=? AND total_points>=?",
            [item.price, guildId, userId, item.price],
            ()=>{
              if(item.stock > 0){
                db.run(
                  "UPDATE shop_items SET stock=stock-1 WHERE id=?",
                  [item.id]
                );
              }
            }
          );

          db.run(
            `INSERT INTO purchases
            (guild_id,user_id,item_id,item_name,price,user_input,created_at)
            VALUES (?,?,?,?,?,?,?)`,
            [
              guildId,
              userId,
              item.id,
              item.name,
              item.price,
              userInput,
              Date.now()
            ]
          );

          db.get(
            "SELECT purchase_channel FROM settings WHERE guild_id=?",
            [guildId],
            async (err, settings) => {
              if (settings?.purchase_channel) {
                const channel = interaction.guild.channels.cache.get(settings.purchase_channel);

                if (channel) {
                  const row = new ActionRowBuilder().addComponents(
new ButtonBuilder()
.setCustomId(`deliver_${userId}_${item.id}_${item.price}`)
.setLabel("✅ تم التسليم")
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId(`reject_${userId}_${item.id}_${item.price}`)
.setLabel("❌ رفض")
.setStyle(ButtonStyle.Danger)
);

channel.send({
content:`🛒 **طلب شراء جديد**

👤 العضو: <@${userId}>
🆔 ID: ${userId}

📦 المنتج: ${item.name}
💰 السعر: ${item.price}

📝 ${item.input_name || "المعلومات"}:
${userInput}

🟡 الحالة: قيد المراجعة`,
components:[row]
}).catch(console.error);
                }
              }
            }
          );

          interaction.reply({
            content:
`✅ تم تسجيل طلبك

📦 المنتج: ${item.name}
📝 ${item.input_name}: ${userInput}`,
            ephemeral: true
          });

        }
      );

    }

    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);

    if (!interaction.replied) {
      await interaction.reply({
        content: "حدث خطأ أثناء تنفيذ الأمر",
        ephemeral: true
      });
    }
  }
});

client.login(process.env.TOKEN);

const dashboard = require("./dashboard/app");
dashboard.set("client", client);

dashboard.listen(process.env.PORT || 3000, () => {
  console.log("🌐 Dashboard running on port 3000");
});

require("./database/currencySetup");

const runGiveaways = require("./giveawayRunner");

setInterval(() => {
  runGiveaways(client);
}, 60000);
