const express = require("express");
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
          voice_interval: 600,
          voice_enabled: 1,
          min_message_length: 10,
          messages_required: 1
        };
      }

      res.render("settings", { settings });
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
        db.all("SELECT * FROM giveaways WHERE guild_id=? ORDER BY id DESC", [guildId], (err, giveaways) => { res.render("dashboard", {guildId, settings, currency, items, giveaways}); });
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
    value
  } = req.body;

  console.log("BODY:", req.body);

  db.run(
    `INSERT INTO shop_items
    (guild_id,name,price,type,value)
    VALUES (?,?,?,?,?)`,
    [guildId,name,price,type,value]
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

   res.redirect("/dashboard/"+guildId);
 }
 );

});

app.post("/dashboard/:guildId/shop", (req,res)=>{
 const guildId=req.params.guildId;
 const {name,price,type,value}=req.body;
 console.log("SHOP DATA:", req.body);
 db.run(
 `INSERT INTO shop_items (guild_id,name,price,type,value,requires_input,input_name)
 VALUES (?,?,?,?,?,?,?)`,
 [guildId,name,price,type,value,req.body.requires_input ? 1 : 0,req.body.input_name || ""],
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

module.exports = app;

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

      res.render("giveaways", {
        guildId,
        giveaways
      });

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


 const time = new Date(run_at).getTime();


 db.run(
 `INSERT INTO giveaways
 (guild_id,name,prize,winners_count,role_id,channel_id,type,entry_fee,run_at,status,created_by)
 VALUES (?,?,?,?,?,?,?,?,?,'active',?)`,
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
 function(err){

   if(err){
     console.error(err);
     return res.send("❌ خطأ أثناء إنشاء السحب");
   }

   res.redirect("/dashboard/"+guildId);

 });

});

