const express = require("express");
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const db = require("../database/connect");
const dashboardProtect = require("./protect");

const app = express();
app.use(require("./session"));
app.use(require("./oauth"));

const DASHBOARD_SESSION_TIMEOUT = 10 * 60 * 1000;

function dashboardAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.redirect("/login");
  }

  const now = Date.now();

  if (
    req.session.lastActivity &&
    now - req.session.lastActivity > DASHBOARD_SESSION_TIMEOUT
  ) {
    return req.session.destroy(() => {
      res.redirect("/login");
    });
  }

  req.session.lastActivity = now;

  next();
}


app.use("/dashboard/:guildId", dashboardAuth, dashboardProtect);
app.use("/settings/:guildId", dashboardAuth, dashboardProtect);
app.use("/shop/:guildId", dashboardAuth, dashboardProtect);

app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.set("views", "./views");

async function checkDashboardGuildAccess(req, res, next) {
  const guildId = req.params.guildId;

  if (!req.session || !req.session.userId || !req.session.accessToken) {
    return res.redirect("/login");
  }

  try {
    const response = await fetch(
      `https://discord.com/api/v10/users/@me/guilds`,
      {
        headers: {
          Authorization: `Bearer ${req.session.accessToken}`
        }
      }
    );

    if (!response.ok) {
      return res.status(401).send("❌ انتهت جلسة Discord، سجل الدخول مرة ثانية.");
    }

    const guilds = await response.json();
    const guild = guilds.find(g => g.id === guildId);

    if (!guild) {
      return res.status(403).send("❌ ليس لديك صلاحية للوصول إلى هذا السيرفر.");
    }

    const permissions = BigInt(guild.permissions || "0");
    const ADMINISTRATOR = 0x8n;

    if (!guild.owner && (permissions & ADMINISTRATOR) !== ADMINISTRATOR) {
      return res.status(403).send("❌ تحتاج إلى صلاحية Administrator.");
    }

    next();

  } catch (err) {
    console.error("DASHBOARD ACCESS ERROR:", err);
    return res.status(500).send("❌ حدث خطأ أثناء التحقق من صلاحيات السيرفر.");
  }
}


app.get("/", async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.redirect("/login");
  }

  try {
    const response = await fetch("https://discord.com/api/v10/users/@me/guilds", {
      headers: {
        Authorization: `Bearer ${req.session.accessToken}`
      }
    });

    if (!response.ok) {
      return res.status(401).send("❌ انتهت جلسة Discord، سجل الدخول مرة ثانية.");
    }

    const guilds = await response.json();

    const manageableGuilds = guilds.filter(guild => {
      const permissions = BigInt(guild.permissions || "0");
      const ADMINISTRATOR = 0x8n;
      return guild.owner || (permissions & ADMINISTRATOR) === ADMINISTRATOR;
    });

    const client = app.get("client");

    const cards = manageableGuilds.map(guild => {
      const botGuild = client.guilds.cache.get(guild.id);

      const icon = guild.icon
        ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128`
        : "https://cdn.discordapp.com/embed/avatars/0.png";

      if (botGuild) {
        return `
          <div style="border:1px solid #ddd;border-radius:12px;padding:15px;margin:10px;background:#fff">
            <img src="${icon}" width="64" height="64" style="border-radius:50%">
            <h3>${guild.name}</h3>
            <p>🟢 البوت موجود في السيرفر</p>
            <a href="/dashboard/${guild.id}"
               style="display:inline-block;padding:10px 18px;background:#5865F2;color:white;text-decoration:none;border-radius:8px">
              ⚙️ دخول للوحة التحكم
            </a>
          </div>
        `;
      }

      const inviteUrl =
        `https://discord.com/oauth2/authorize?client_id=${process.env.CLIENT_ID}` +
        `&scope=bot%20applications.commands` +
        `&permissions=8` +
        `&guild_id=${guild.id}`;

      return `
        <div style="border:1px solid #ddd;border-radius:12px;padding:15px;margin:10px;background:#fff">
          <img src="${icon}" width="64" height="64" style="border-radius:50%">
          <h3>${guild.name}</h3>
          <p>🔴 البوت غير موجود في السيرفر</p>
          <a href="${inviteUrl}"
             style="display:inline-block;padding:10px 18px;background:#57F287;color:white;text-decoration:none;border-radius:8px">
            ➕ إضافة البوت
          </a>
        </div>
      `;
    }).join("");

    res.send(`
      <!DOCTYPE html>
      <html dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>MD Points - السيرفرات</title>
      </head>
      <body style="font-family:Arial;background:#f5f5f5;padding:30px">
        <div style="max-width:900px;margin:auto">
          <h1>🤖 MD Points</h1>
          <h2>اختر السيرفر الذي تريد التحكم به</h2>
          <p>مرحبًا <b>${req.session.username || ""}</b></p>

          ${cards || "<p>❌ لا يوجد لديك سيرفرات يمكنك التحكم بها.</p>"}

          <br>
          <a href="/logout">🚪 تسجيل الخروج</a>
        </div>
      </body>
      </html>
    `);

  } catch (err) {
    console.error("GUILDS PAGE ERROR:", err);
    res.status(500).send("❌ حدث خطأ أثناء جلب السيرفرات.");
  }
});

app.get("/settings/:guildId", dashboardAuth, checkDashboardGuildAccess, (req, res) => {
  const guildId = req.params.guildId;

  db.get(
    "SELECT * FROM settings WHERE guild_id = ?",
    [guildId],
    (err, settings) => {
      if (!settings) {
        settings = {
          text_points: 1,
          voice_points: 1,
          voice_interval: 10,
          voice_enabled: 1,
          min_message_length: 10,
          messages_required: 1
        };
      }

      res.render("settings", { settings, guildId });
    }
  );
});

app.post("/settings/:guildId", (req, res) => {
  const guildId = req.params.guildId;

  const {
    text_points,
    voice_points,
    voice_interval,
    voice_enabled,
    min_message_length,
    messages_required,
    purchase_channel
  } = req.body;

  console.log("BODY:", req.body);

  db.run(
    `INSERT INTO settings
    (guild_id, text_points, voice_points, voice_interval, voice_enabled, min_message_length, messages_required, purchase_channel)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(guild_id)
    DO UPDATE SET
    text_points=?,
    voice_points=?,
    voice_interval=?,
    voice_enabled=?,
    min_message_length=?,
    messages_required=?,
    purchase_channel=?`,
    [
      guildId,
      text_points,
      voice_points,
      voice_interval,
      voice_enabled,
      min_message_length,
      messages_required,
      purchase_channel,
      text_points,
      voice_points,
      voice_interval,
      voice_enabled,
      min_message_length,
      messages_required,
      purchase_channel
    ]
  );

  res.send("✅ تم حفظ الإعدادات");
});

app.get("/dashboard/:guildId", dashboardAuth, checkDashboardGuildAccess, async (req,res)=>{
  const guildId = req.params.guildId;

  db.get("SELECT * FROM settings WHERE guild_id=?", [guildId], (err, settings)=>{
    db.get("SELECT * FROM currencies WHERE guild_id=? LIMIT 1", [guildId], (err, currency)=>{
      db.all("SELECT * FROM shop_items WHERE guild_id=?", [guildId], (err, items)=>{
        db.all("SELECT * FROM giveaways WHERE guild_id=? ORDER BY id DESC", [guildId], (err, giveaways) => {

          db.all("SELECT * FROM giveaway_winners", [], (e, winners) => {

            db.all("SELECT * FROM giveaway_entries", [], (e2, entries) => {

              res.render("dashboard", {
                guildId,
                settings,
                currency,
                items,
                giveaways,
                winners: winners || [],
                entries: entries || []
              });

            });

          });

        });
      });
    });
  });
});



app.get("/shop/:guildId", dashboardAuth, checkDashboardGuildAccess, (req,res)=>{
  const guildId = req.params.guildId;

  db.all(
    "SELECT * FROM shop_items WHERE guild_id=?",
    [guildId],
    (err, items)=>{
      res.render("shop",{items});
    }
  );
});


app.post("/shop/:guildId", (req,res)=>{
  const guildId = req.params.guildId;

  const {
    name,
    price,
    type,
    value,
    stock
  } = req.body;

  console.log("BODY:", req.body);

  db.run(
    `INSERT INTO shop_items
    (guild_id,name,price,type,value,stock)
    VALUES (?,?,?,?,?,?)`,
    [guildId,name,price,type,value,stock || -1]
  );

  res.redirect("/shop/"+guildId);
});
app.post("/dashboard/:guildId", async (req, res) => {
  const guildId = req.params.guildId;

  const {
    text_points,
    voice_points,
    voice_interval,
    min_message_length,
    messages_required,
    purchase_channel
  } = req.body;

  console.log("BODY:", req.body);

  try {
    const newInterval = Number(voice_interval || 0);

    if (newInterval <= 0) {
      return res.status(400).send(
        "voice_interval must be greater than 0"
      );
    }

    /*
     * قراءة الإعداد القديم قبل التعديل.
     */

    const oldSettings = await db.get(
      `SELECT voice_interval
       FROM settings
       WHERE guild_id=?`,
      [guildId]
    );


    const oldInterval =
      Number(oldSettings?.voice_interval || 0);


    console.log(
      "OLD INTERVAL:",
      oldInterval,
      "NEW INTERVAL:",
      newInterval
    );

    /*
     * حفظ الإعدادات الجديدة.
     */
    await db.run(
      `UPDATE settings SET
        text_points=?,
        voice_points=?,
        voice_interval=?,
        min_message_length=?,
        messages_required=?,
        purchase_channel=?
       WHERE guild_id=?`,
      [
        Number(text_points || 0),
        Number(voice_points || 0),
        newInterval,
        Number(min_message_length || 0),
        Number(messages_required || 0),
        purchase_channel || null,
        guildId
      ]
    );

    console.log(
      "SETTINGS UPDATED:",
      guildId,
      `${oldInterval} -> ${newInterval} MIN`
    );

    /*
     * إذا تغيرت مدة الصوت:
     *
     * 1. نحذف كل الوقت المتراكم.
     * 2. نبدأ جلسة جديدة من الآن.
     * 3. نحفظ المدة الجديدة.
     *
     * لا يتم تحويل الوقت القديم إلى نقاط.
     */
    if (
      oldInterval > 0 &&
      oldInterval !== newInterval
    ) {
      const now = Date.now();

      const result = await db.run(
        `UPDATE users
         SET
           voice_started_at=?,
           voice_accumulated=0,
           voice_interval_minutes=?
         WHERE guild_id=?`,
        [
          now,
          newInterval,
          guildId
        ]
      );

      console.log(
        "🎙️ ALL VOICE SESSIONS RESET:",
        guildId,
        "USERS:",
        result?.rowCount ?? 0,
        `${oldInterval} -> ${newInterval} MIN`,
        "OLD TIME DISCARDED"
      );
    }

    return res.redirect(
      "/dashboard/" + guildId
    );

  } catch (err) {
    console.error(
      "❌ DASHBOARD SETTINGS ERROR:",
      err
    );

    return res
      .status(500)
      .send(
        err.message ||
        "Dashboard settings error"
      );
  }
});

app.post("/dashboard/:guildId/shop", (req,res)=>{
 const guildId=req.params.guildId;
 const {name,price,type,value,required_role_id}=req.body;
 console.log("SHOP DATA:", req.body);
 db.run(
 `INSERT INTO shop_items
  (guild_id,name,price,type,value,requires_input,input_name,stock,required_role_id)
  VALUES (?,?,?,?,?,?,?,?,?)`,
 [
   guildId,
   name,
   price,
   type,
   value,
   req.body.requires_input ? 1 : 0,
   req.body.input_name || "",
   req.body.stock === "" || req.body.stock == null ? -1 : Number(req.body.stock),
   required_role_id || null
 ],
 (err)=>{
   if (err) {
     console.error("❌ SHOP INSERT ERROR:", err);
     return res.status(500).send("❌ فشل حفظ الصنف: " + err.message);
   }

   console.log("✅ SHOP ITEM SAVED:", guildId, name);
   res.redirect("/dashboard/"+guildId);
 }
 );
});

app.get("/dashboard/:guildId/shop/delete/:id", (req,res)=>{
 const guildId=req.params.guildId;
 const id=req.params.id;

 db.run(
 "DELETE FROM shop_items WHERE id=? AND guild_id=?",
 [id,guildId],
 ()=>res.redirect("/dashboard/"+guildId)
 );
});


app.get("/dashboard/:guildId/shop/edit/:id", (req,res)=>{
 const guildId=req.params.guildId;
 const id=req.params.id;

 db.get(
  "SELECT * FROM shop_items WHERE id=? AND guild_id=?",
  [id,guildId],
  (err,item)=>{
    res.send(`
    <form method="POST" action="/dashboard/${guildId}/shop/edit/${id}">
      الاسم:
      <input name="name" value="${item.name}">
      <br>
      السعر:
      <input name="price" value="${item.price}">
      <br>
      النوع:
      <input name="type" value="${item.type}">
      <br>
      القيمة:
      <input name="value" value="${item.value}">
      <br>
      <button>حفظ</button>
    </form>
    `);
  }
 );
});


app.post("/dashboard/:guildId/shop/edit/:id", (req,res)=>{
 const guildId=req.params.guildId;
 const id=req.params.id;

 const {name,price,type,value}=req.body;

 db.run(
  `UPDATE shop_items SET
   name=?,
   price=?,
   type=?,
   value=?
   WHERE id=? AND guild_id=?`,
  [name,price,type,value,id,guildId],
  ()=>{
   res.redirect("/dashboard/"+guildId);
  }
 );
});

app.get("/login", (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect("/");
  }

  res.send(`
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>MD Points - Login</title>
    </head>
    <body style="font-family:Arial;text-align:center;padding:60px">
      <h2>🔐 MD Points Dashboard</h2>
      <p>سجل الدخول بحساب Discord للتحكم بالبوت.</p>
      <a href="/auth/discord"
         style="display:inline-block;padding:14px 25px;background:#5865F2;color:white;text-decoration:none;border-radius:8px">
        🔵 تسجيل الدخول عبر Discord
      </a>
    </body>
    </html>
  `);
});

app.get("/logout",(req,res)=>{
  req.session.destroy(()=>{
    res.send("✅ تم تسجيل الخروج");
  });
});


app.get("/dashboard/:guildId/giveaways", dashboardAuth, checkDashboardGuildAccess, (req, res) => {

  const guildId = req.params.guildId;

  db.all(
    "SELECT * FROM giveaways WHERE guild_id=? ORDER BY id DESC",
    [guildId],
    (err, giveaways) => {

      if (err) {
        console.error(err);
        return res.send("Database Error");
      }

      db.all(
        "SELECT * FROM giveaway_winners",
        [],
        (e, winners) => {

          res.render("giveaways", {
            guildId,
            giveaways,
            winners: winners || []
          });

        }
      );

    }
  );

});


app.post("/dashboard/:guildId/giveaways", dashboardAuth, checkDashboardGuildAccess, (req,res)=>{

 const guildId = req.params.guildId;

 const {
   name,
   prize,
   winners_count,
   type,
   entry_fee,
   role_id,
   channel_id,
   run_at
 } = req.body;


 const time = run_at ? new Date(run_at).getTime() : Date.now();


 db.run(
 `INSERT INTO giveaways
 (guild_id,name,prize,winners_count,role_id,channel_id,type,entry_fee,run_at,status,created_by)
 VALUES (?,?,?,?,?,?,?,?,?,'active',?) RETURNING id`,
 [
   guildId,
   name,
   prize,
   winners_count,
   role_id || null,
   channel_id,
   type,
   entry_fee || 0,
   time,
   guildId
 ],
 async function(err, result){

   if(err){
     console.error(err);
     return res.send("❌ خطأ أثناء إنشاء السحب");
   }

   const giveawayId = result.rows[0].id;

   const client = req.app.get("client");

   if(!client){
     console.error("❌ CLIENT NOT AVAILABLE");
     return res.status(500).send("❌ البوت غير متصل");
   }

   if(!channel_id){
     console.error("❌ CHANNEL ID MISSING");
     return res.status(400).send("❌ لم يتم تحديد قناة السحب");
   }

   try {
     const channel = await client.channels.fetch(channel_id);

     if(!channel){
       console.error("❌ CHANNEL NOT FOUND:", channel_id);
       return res.status(404).send("❌ قناة السحب غير موجودة");
     }

     const fee = Number(entry_fee || 0);

     const feeText = fee > 0
       ? `

💰 **رسوم المشاركة: ${fee} نقطة**
⚠️ سيتم خصم **${fee} نقطة** من رصيدك عند المشاركة.`
       : "";

     const message = {
       content:
`🎁 **سحب جديد**

📌 الاسم: ${name}

🎁 الجائزة: ${prize}

🏆 عدد الفائزين: ${winners_count}${feeText}`
     };

     if(type !== "forced"){
       const row = new ActionRowBuilder()
         .addComponents(
           new ButtonBuilder()
             .setCustomId(`join_giveaway_${giveawayId}`)
             .setLabel("🎉 مشاركة")
             .setStyle(ButtonStyle.Primary)
         );

       message.components = [row];
     } else {
       message.content += `

⚡ سحب إجباري - سيتم اختيار الفائزين تلقائيًا من الرتبة المحددة`;
     }

     await channel.send(message);

     console.log("✅ GIVEAWAY MESSAGE SENT:", giveawayId, channel_id);

     return res.redirect("/dashboard/"+guildId);

   } catch(err) {
     console.error("❌ GIVEAWAY DISCORD ERROR:", err);
     return res.status(500).send("❌ حدث خطأ أثناء إرسال السحب إلى Discord");
   }

 });

});


app.get("/dashboard/:guildId/giveaways/delete/:id", dashboardAuth, checkDashboardGuildAccess, (req,res)=>{
 const client = req.app.get("client");
 console.log("DELETE GIVEAWAY:", req.params);

 const {guildId,id}=req.params;

 db.run(
  "DELETE FROM giveaways WHERE id=? AND guild_id=?",
  [id,guildId],
  ()=>{
    res.redirect("/dashboard/"+guildId+"/giveaways");
  }
 );

});


app.get("/dashboard/:guildId/giveaways/edit/:id",(req,res)=>{

 const {guildId,id}=req.params;

 db.get(
  "SELECT * FROM giveaways WHERE id=? AND guild_id=?",
  [id,guildId],
  (err,g)=>{

   if(!g) return res.send("السحب غير موجود");

   res.send(`
   <form method="POST" action="/dashboard/${guildId}/giveaways/edit/${id}">

   الاسم:
   <input name="name" value="${g.name}">

   الجائزة:
   <input name="prize" value="${g.prize}">

   عدد الفائزين:
   <input name="winners_count" value="${g.winners_count}">

   <button>💾 حفظ</button>

   </form>
   `);

  }
 );

});


app.post("/dashboard/:guildId/giveaways/edit/:id",(req,res)=>{

 const {guildId,id}=req.params;

 const {name,prize,winners_count}=req.body;

 db.run(
 `UPDATE giveaways SET
 name=?,
 prize=?,
 winners_count=?
 WHERE id=? AND guild_id=?`,
 [
 name,
 prize,
 winners_count,
 id,
 guildId
 ],
 ()=>{
   res.redirect("/dashboard/"+guildId+"/giveaways");
 }
 );

});


app.get("/dashboard/:guildId/giveaways/reroll/:id", dashboardAuth, checkDashboardGuildAccess, async (req, res) => {

  const { guildId, id } = req.params;
  const client = req.app.get("client");

  if (!client) {
    return res.status(500).send("❌ البوت غير متصل");
  }

  try {

    const g = await db.get(
      "SELECT * FROM giveaways WHERE id=? AND guild_id=?",
      [id, guildId]
    );

    if (!g) {
      return res.send("❌ السحب غير موجود");
    }

    let users = [];

    if (g.type === "forced") {

      const guild = await client.guilds.fetch(g.guild_id);

      await guild.members.fetch();

      users = [...guild.members.cache.values()]
        .filter(member =>
          g.role_id &&
          member.roles.cache.has(g.role_id)
        )
        .map(member => member.id);

    } else {

      const entries = await db.all(
        "SELECT user_id FROM giveaway_entries WHERE giveaway_id=?",
        [id]
      );

      users = entries.map(row => row.user_id);

      // إعادة فحص الرتبة في السحب الاختياري
      if (g.role_id) {

        const guild = await client.guilds.fetch(g.guild_id);

        await guild.members.fetch();

        users = users.filter(userId => {
          const member = guild.members.cache.get(userId);
          return member && member.roles.cache.has(g.role_id);
        });
      }

    }

    const oldWinners = await db.all(
      "SELECT user_id FROM giveaway_winners WHERE giveaway_id=?",
      [id]
    );

    const oldIds = oldWinners.map(row => row.user_id);

    users = users.filter(userId => !oldIds.includes(userId));

    console.log(
      "🔄 REROLL:",
      id,
      "TYPE:",
      g.type,
      "ELIGIBLE:",
      users.length
    );

    if (!users.length) {
      return res.send("❌ لا يوجد مشاركين مؤهلين لإعادة السحب");
    }

    const winner =
      users[Math.floor(Math.random() * users.length)];

    await db.run(
      "DELETE FROM giveaway_winners WHERE giveaway_id=?",
      [id]
    );

    await db.run(
      "INSERT INTO giveaway_winners (giveaway_id,user_id,created_at) VALUES (?,?,?)",
      [id, winner, Date.now()]
    );

    const channel = await client.channels
      .fetch(g.channel_id)
      .catch(() => null);

    if (channel) {

      await channel.send(
`🔄 **تم إعادة السحب**

🎁 الجائزة: ${g.prize}

🏆 الفائز الجديد:
<@${winner}>`
      );

    }

    return res.redirect(
      "/dashboard/" + guildId + "/giveaways"
    );

  } catch (err) {

    console.error("❌ REROLL ERROR:", err);

    return res.status(500).send(
      "❌ حدث خطأ أثناء إعادة السحب"
    );

  }

});

module.exports = app;
