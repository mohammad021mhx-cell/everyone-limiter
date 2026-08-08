const express = require("express");
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const db = require("../database/connect");

const app = express();
app.use(require("./session"));

app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.set("views", "./views");

app.get("/", (req, res) => {
  res.send("MD Points Dashboard Online");
});

app.get("/settings/:guildId", (req, res) => {
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

app.get("/dashboard/:guildId", (req,res)=>{
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



app.get("/shop/:guildId", (req,res)=>{
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
app.post("/dashboard/:guildId", (req,res)=>{
 const guildId=req.params.guildId;

 const {
 text_points,
 voice_points,
 voice_interval,
 min_message_length,
 messages_required,
 purchase_channel
 }=req.body;

 console.log(req.body);

 db.run(
 `UPDATE settings SET
 text_points=?,
 voice_points=?,
 voice_interval=?,
 min_message_length=?,
 messages_required=?,
 purchase_channel=?
 WHERE guild_id=?`,
 [
 text_points,
 voice_points,
 voice_interval,
 min_message_length,
 messages_required,
 purchase_channel,
 guildId
 ],
 function(err){
   if(err){
     console.error("UPDATE ERROR:", err);
     return res.status(500).send(err.message);
   }

   console.log("Rows updated:", this.changes);
 }
 );


});

app.post("/dashboard/:guildId/shop", (req,res)=>{
 const guildId=req.params.guildId;
 const {name,price,type,value}=req.body;
 console.log("SHOP DATA:", req.body);
 db.run(
 `INSERT INTO shop_items (guild_id,name,price,type,value,requires_input,input_name,stock)
 VALUES (?,?,?,?,?,?,?,?)`,
 [guildId,name,price,type,value,req.body.requires_input ? 1 : 0,req.body.input_name || "",req.body.stock || -1],
 ()=>{
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

app.get("/login/:userId", (req,res)=>{
  const code = req.query.code;

  if(code !== process.env.DASHBOARD_CODE){
    return res.send("❌ رمز القفل غير صحيح");
  }
  req.session.userId = req.params.userId;
  res.send("✅ تم تسجيل الدخول للداشبورد");
});

app.get("/logout",(req,res)=>{
  req.session.destroy(()=>{
    res.send("✅ تم تسجيل الخروج");
  });
});


app.get("/dashboard/:guildId/giveaways", (req, res) => {

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


app.post("/dashboard/:guildId/giveaways", (req,res)=>{

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


app.get("/dashboard/:guildId/giveaways/delete/:id",(req,res)=>{
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


app.get("/dashboard/:guildId/giveaways/reroll/:id",(req,res)=>{

 const {guildId,id}=req.params;

 db.get(
  "SELECT * FROM giveaways WHERE id=? AND guild_id=?",
  [id,guildId],
  async (err,g)=>{

   if(!g) return res.send("السحب غير موجود");

   let users=[];

   if(g.type==="forced"){

    try{

     const guild = await client.guilds.fetch(g.guild_id);
     const members = guild.members.cache;

     users = [...members.values()]
      .filter(m=>m.roles.cache.has(g.role_id))
      .map(m=>m.id);

    }catch(e){
     console.error("REROLL MEMBERS ERROR:", e);
     return res.send("خطأ بجلب الأعضاء");
    }

   }else{

    db.all(
     "SELECT user_id FROM giveaway_entries WHERE giveaway_id=?",
     [id],
     (e,rows)=>{

      users = rows.map(x=>x.user_id);

     }
    );

   }


   db.all(
    "SELECT user_id FROM giveaway_winners WHERE giveaway_id=?",
    [id],
    (e,old)=>{

     console.log("REROLL BEFORE FILTER:", users.length);
     const oldIds=(old||[]).map(x=>x.user_id);

     users=users.filter(u=>u !== oldIds[oldIds.length - 1]);
     console.log("REROLL AFTER FILTER:", users.length);

     if(!users.length)
       return res.send("لا يوجد مشاركين جدد");


     const winner=users[Math.floor(Math.random()*users.length)];


     db.run(
      "DELETE FROM giveaway_winners WHERE giveaway_id=?",
      [id],
      ()=>{

       db.run(
        "INSERT INTO giveaway_winners (giveaway_id,user_id,created_at) VALUES (?,?,?)",
        [id,winner,Date.now()],
        async ()=>{
       
       const channel = await client.channels.fetch(g.channel_id).catch(e=>{
        console.error("REROLL CHANNEL ERROR:", e.message);
        return null;
       });

       console.log("REROLL CHANNEL:", !!channel);

       if(channel){
        channel.send(
`🔄 **تم إعادة السحب**

🎁 الجائزة: ${g.prize}

🏆 الفائز الجديد:
<@${winner}>`
        ).catch(e=>{
          console.error("REROLL SEND ERROR:", e.message);
        });
       }

       res.redirect("/dashboard/"+guildId);
        }
       );
      }

     );

    }
   );

  }
 );

});


module.exports = app;
