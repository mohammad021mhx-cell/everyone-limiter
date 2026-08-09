const checkStaffPermission = require("./utils/checkStaffPermission");
require("dotenv").config();
process.env.TZ = "Asia/Baghdad";

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

client.once("clientReady", async () => {
  const db = require("./database/connect");

  console.log(`🤖 تم تسجيل الدخول باسم ${client.user.tag}`);
  console.log("🌍 تجهيز إعدادات جميع السيرفرات...");

  for (const guild of client.guilds.cache.values()) {
    try {
      await db.run(
        `INSERT INTO settings
         (guild_id, text_enabled, voice_enabled, text_points, voice_points,
          voice_interval, message_cooldown, min_message_length, messages_required)
         VALUES (?,1,1,1,1,1,60,3,30)
         ON CONFLICT (guild_id) DO NOTHING`,
        [guild.id]
      );

      console.log(`✅ SETTINGS OK: ${guild.name} (${guild.id})`);
    } catch (err) {
      console.error(`❌ SETTINGS ERROR ${guild.id}:`, err);
    }
  }
});

client.on(messageCreate.name, (...args) => messageCreate.execute(...args));
client.on(voiceStateUpdate.name, (...args) => voiceStateUpdate.execute(...args));

client.on("interactionCreate", async interaction => {

  if (interaction.isButton()) {

    if (interaction.customId.startsWith("join_giveaway_")) {

      const db = require("./database/connect");
      const giveawayId = interaction.customId.split("_")[2];
      const guildId = interaction.guild.id;
      const userId = interaction.user.id;

      console.log(
        "🎉 GIVEAWAY BUTTON:",
        interaction.customId,
        "ID:",
        giveawayId,
        "USER:",
        userId
      );

      db.get(
        "SELECT * FROM giveaways WHERE id=? AND guild_id=?",
        [giveawayId, guildId],
        function(err, giveaway) {

          if (err || !giveaway) {
            console.error("❌ GIVEAWAY LOAD ERROR:", err);

            return interaction.reply({
              content: "❌ السحب غير موجود.",
              ephemeral: true
            });
          }

          if (giveaway.status !== "active") {
            return interaction.reply({
              content: "❌ هذا السحب غير متاح للمشاركة حاليًا.",
              ephemeral: true
            });
          }

          db.get(
            "SELECT id FROM giveaway_entries WHERE giveaway_id=? AND user_id=?",
            [giveawayId, userId],
            function(err, row) {

              if (err) {
                console.error("❌ GIVEAWAY ENTRY CHECK ERROR:", err);

                return interaction.reply({
                  content: "❌ حدث خطأ أثناء التحقق من مشاركتك.",
                  ephemeral: true
                });
              }

              if (row) {
                return interaction.reply({
                  content: "⚠️ أنت مسجل بالفعل في هذا السحب.",
                  ephemeral: true
                });
              }

              const fee = Number(giveaway.entry_fee || 0);

              // السحب المدفوع
              if (fee > 0) {

                db.get(
                  "SELECT total_points FROM users WHERE guild_id=? AND user_id=?",
                  [guildId, userId],
                  function(balanceErr, user) {

                    if (balanceErr) {
                      console.error("❌ GIVEAWAY BALANCE ERROR:", balanceErr);

                      return interaction.reply({
                        content: "❌ حدث خطأ أثناء فحص رصيدك.",
                        ephemeral: true
                      });
                    }

                    const balance = Number(user?.total_points || 0);

                    if (balance < fee) {
                      return interaction.reply({
                        content:
                          `❌ لا يمكنك المشاركة.
` +
                          `💰 رسوم المشاركة: **${fee} نقطة**
` +
                          `💳 رصيدك الحالي: **${balance} نقطة**`,
                        ephemeral: true
                      });
                    }

                    db.run(
                      `UPDATE users
                       SET total_points = total_points - ?
                       WHERE guild_id=? AND user_id=? AND total_points >= ?`,
                      [fee, guildId, userId, fee],
                      function(updateErr) {

                        if (updateErr) {
                          console.error("❌ GIVEAWAY FEE ERROR:", updateErr);

                          return interaction.reply({
                            content: "❌ حدث خطأ أثناء خصم رسوم المشاركة.",
                            ephemeral: true
                          });
                        }

                        db.run(
                          `INSERT INTO giveaway_entries
                           (giveaway_id,user_id,joined_at)
                           VALUES (?,?,?)
                           ON CONFLICT (giveaway_id,user_id) DO NOTHING`,
                          [giveawayId, userId, Date.now()],
                          function(insertErr) {

                            if (insertErr) {
                              console.error(
                                "❌ GIVEAWAY ENTRY INSERT ERROR:",
                                insertErr
                              );

                              // إعادة النقاط إذا فشل تسجيل المشاركة
                              db.run(
                                `UPDATE users
                                 SET total_points = total_points + ?
                                 WHERE guild_id=? AND user_id=?`,
                                [fee, guildId, userId]
                              );

                              return interaction.reply({
                                content: "❌ حدث خطأ أثناء تسجيل مشاركتك وتمت إعادة نقاطك.",
                                ephemeral: true
                              });
                            }

                            return interaction.reply({
                              content:
                                `🎉 تم تسجيل مشاركتك في السحب.
` +
                                `💰 تم خصم **${fee} نقطة** من رصيدك.`,
                              ephemeral: true
                            });

                          }
                        );
                      }
                    );
                  }
                );

                return;
              }

              // السحب المجاني
              db.run(
                `INSERT INTO giveaway_entries
                 (giveaway_id,user_id,joined_at)
                 VALUES (?,?,?)
                 ON CONFLICT (giveaway_id,user_id) DO NOTHING`,
                [giveawayId, userId, Date.now()],
                function(insertErr) {

                  if (insertErr) {
                    console.error(
                      "❌ GIVEAWAY ENTRY INSERT ERROR:",
                      insertErr
                    );

                    return interaction.reply({
                      content: "❌ حدث خطأ أثناء تسجيل مشاركتك.",
                      ephemeral: true
                    });
                  }

                  return interaction.reply({
                    content: "🎉 تم تسجيل مشاركتك في السحب.",
                    ephemeral: true
                  });

                }
              );

            }
          );

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
                function(err) {

                  if (err || this.changes === 0) {
                    return interaction.reply({
                      content: "❌ تعذر خصم النقاط، حاول مرة أخرى.",
                      ephemeral: true
                    });
                  }

                  db.get(
                    "SELECT purchase_channel FROM settings WHERE guild_id=?",
                    [guildId],
                    async (err, settings) => {
                  if (!settings?.purchase_channel)
                    return interaction.reply({
                      content: "❌ لم يتم تحديد قناة الطلبات.",
                      ephemeral: true
                    });

                  const channel = interaction.guild.channels.cache.get(settings.purchase_channel);

                  if (!channel)
                    return interaction.reply({
                      content: "❌ قناة الطلبات غير موجودة.",
                      ephemeral: true
                    });

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
                    content: `🛒 **طلب شراء جديد**

👤 العضو: <@${userId}>
🆔 ID: ${userId}

📦 المنتج: ${item.name}
💰 السعر: ${item.price}

🟡 الحالة: قيد المراجعة`,
                    components: [row]
                  });

                  interaction.reply({
                    content: "✅ تم إرسال طلبك للإدارة وبانتظار الموافقة.",
                    ephemeral: true
                  });
                    }
                  );

                }
              );

            }
          );

        }
      );
    }

    if (interaction.customId.startsWith("deliver_")) {

      if (!(await checkStaffPermission(interaction)))
        return;

      await interaction.update({
        content: interaction.message.content + "\n\n✅ **تم التسليم**",
        components:[]
      });

      return;
    }

    if (interaction.customId.startsWith("reject_")) {

      if (!(await checkStaffPermission(interaction)))
        return;

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

      Promise.resolve(interaction.guild.members.cache.get(userId)).then(member=>{
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

          if (err || !item) {
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
            `UPDATE users
             SET total_points = total_points - ?
             WHERE guild_id=? AND user_id=? AND total_points >= ?`,
            [item.price, guildId, userId, item.price],
            function(err) {

              if (err || this.changes === 0) {
                return interaction.reply({
                  content: "❌ رصيدك لا يكفي أو تعذر خصم النقاط.",
                  ephemeral: true
                });
              }

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
                ],
                (err) => {

                  if (err) {
                    console.error("❌ PURCHASE INSERT ERROR:", err);

                    // إذا فشل تسجيل الطلب، نرجع النقاط التي تم خصمها
                    db.run(
                      "UPDATE users SET total_points=total_points+? WHERE guild_id=? AND user_id=?",
                      [item.price, guildId, userId]
                    );

                    return interaction.reply({
                      content: "❌ حدث خطأ أثناء تسجيل الطلب وتمت إعادة النقاط.",
                      ephemeral: true
                    });
                  }

                  db.get(
                    "SELECT purchase_channel FROM settings WHERE guild_id=?",
                    [guildId],
                    async (err, settings) => {

                      if (!settings?.purchase_channel) {
                        db.run(
                          "UPDATE users SET total_points=total_points+? WHERE guild_id=? AND user_id=?",
                          [item.price, guildId, userId]
                        );

                        return interaction.reply({
                          content: "❌ لم يتم تحديد قناة الطلبات وتمت إعادة النقاط.",
                          ephemeral: true
                        });
                      }

                      const channel = interaction.guild.channels.cache.get(
                        settings.purchase_channel
                      );

                      if (!channel) {
                        db.run(
                          "UPDATE users SET total_points=total_points+? WHERE guild_id=? AND user_id=?",
                          [item.price, guildId, userId]
                        );

                        return interaction.reply({
                          content: "❌ قناة الطلبات غير موجودة وتمت إعادة النقاط.",
                          ephemeral: true
                        });
                      }

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

                      await channel.send({
                        content: `🛒 **طلب شراء جديد**

👤 العضو: <@${userId}>
🆔 ID: ${userId}

📦 المنتج: ${item.name}
💰 السعر: ${item.price}

📝 ${item.input_name || "المعلومات"}:
${userInput}

🟡 الحالة: قيد المراجعة`,
                        components: [row]
                      });

                      return interaction.reply({
                        content:
`✅ تم تسجيل طلبك

📦 المنتج: ${item.name}
💰 تم خصم: ${item.price} نقطة
📝 ${item.input_name || "المعلومات"}: ${userInput}

🟡 الطلب بانتظار مراجعة الإدارة.`,
                        ephemeral: true
                      });

                    }
                  );

                }
              );

            }
          );

        }
      );

    }

    return;
  }

  console.log("SLASH:", interaction.commandName, interaction.user.id);
  if (!interaction.isChatInputCommand()) return;

  console.log("COMMAND:", interaction.commandName, interaction.user.tag);
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

client.once("clientReady", async () => {
  console.log("🎙️ فحص حالات الصوت...");

  // ننتظر قليلًا حتى تكون حالات الصوت جاهزة في الكاش
  await new Promise(resolve => setTimeout(resolve, 2000));

  let found = 0;

  for (const guild of client.guilds.cache.values()) {
    try {
      for (const [userId, voiceState] of guild.voiceStates.cache) {

        if (!voiceState.channel) continue;

        const member = voiceState.member;

        if (!member || member.user.bot) continue;

        found++;

        console.log(
          "🎙️ VOICE MEMBER FOUND:",
          member.id,
          member.user.tag,
          "CHANNEL:",
          voiceState.channel.id
        );

        await voiceStateUpdate.startVoiceTimer(member);
      }

    } catch (err) {
      console.error("VOICE STARTUP ERROR:", guild.id, err);
    }
  }

  console.log(`🎙️ تم العثور على ${found} عضو داخل الرومات الصوتية`);
});

client.login(process.env.TOKEN);

const dashboard = require("./dashboard/app");
dashboard.set("client", client);
dashboard.locals.client = client;

dashboard.listen(15719, "0.0.0.0", () => {
  console.log("🌐 Dashboard running on port 3000");
});

require("./database/currencySetup");

const runGiveaways = require("./giveawayRunner");

setInterval(() => {
  runGiveaways(client);
}, 60000);

client.on("guildCreate", async (guild) => {
  console.log(`🆕 دخل سيرفر جديد: ${guild.name} (${guild.id})`);

  const db = require("./database/connect");

  try {
    await db.run(
      `INSERT INTO settings
       (guild_id, text_enabled, voice_enabled, text_points, voice_points,
        voice_interval, message_cooldown, min_message_length, messages_required)
       VALUES (?,1,1,1,1,1,60,3,30)
       ON CONFLICT (guild_id) DO NOTHING`,
      [guild.id]
    );

    console.log(`✅ تم تجهيز إعدادات السيرفر: ${guild.id}`);

    // فحص أعضاء الرومات الصوتية من الـ cache فقط
    // بدون guild.members.fetch() لتجنب Rate Limits
    let found = 0;

    for (const [userId, voiceState] of guild.voiceStates.cache) {
      if (!voiceState.channel) continue;

      const member = voiceState.member;

      if (!member || member.user.bot) continue;

      found++;

      console.log(
        "🎙️ NEW GUILD VOICE MEMBER:",
        member.id,
        member.user.tag,
        "CHANNEL:",
        voiceState.channel.id
      );

      voiceStateUpdate.startVoiceTimer(member);
    }

    console.log(
      `🎙️ تم فحص السيرفر الجديد: ${found} عضو داخل الرومات الصوتية`
    );

  } catch (err) {
    console.error("❌ GUILD INIT ERROR:", err);
  }
});
