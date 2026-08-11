console.log("GIVEAWAY RUNNER WORKING");
const db = require("./database/connect");
const processing = new Set();

module.exports = function(client){

 db.all(
  "SELECT * FROM giveaways WHERE status='active' AND run_at <= ?",
  [Date.now()],
  async (err, giveaways)=>{

   if(err) return console.error(err);


   for(const giveaway of giveaways){

    if(processing.has(giveaway.id)){
      continue;
    }

    processing.add(giveaway.id);

    let users=[];

    if(giveaway.type === "forced"){

      let guild;

      try {

        guild = await client.guilds.fetch(giveaway.guild_id);

      } catch(err){

        console.error("GUILD FETCH ERROR:", err.message);
        processing.delete(giveaway.id);
        continue;

      }

      let members;

      try {

        // استخدم الأعضاء الموجودين بالكاش بدل طلب كل أعضاء السيرفر من Discord
        members = guild.members.cache;

  
      } catch(err){

        console.error("MEMBERS FETCH ERROR:", err.message);
        continue;

      }

      users = [...members.values()]
        .filter(m => !giveaway.role_id || m.roles.cache.has(giveaway.role_id))
        .map(m => m.id);

      // السحب الإجباري برسوم
      const fee = Number(giveaway.entry_fee || 0);

      if (fee > 0) {
        const paidUsers = [];

        for (const userId of users) {
          try {
            // لا تخصم من العضو أكثر من مرة
            const existing = await new Promise(resolve => {
              db.get(
                "SELECT id FROM giveaway_entries WHERE giveaway_id=? AND user_id=?",
                [giveaway.id, userId],
                (e, row) => resolve(e ? null : row)
              );
            });

            if (existing) {
              paidUsers.push(userId);
              continue;
            }

            const user = await new Promise(resolve => {
              db.get(
                "SELECT total_points FROM users WHERE guild_id=? AND user_id=?",
                [giveaway.guild_id, userId],
                (e, row) => resolve(e ? null : row)
              );
            });

            const balance = Number(user?.total_points || 0);

            if (balance < fee) {
              continue;
            }

            const result = await new Promise(resolve => {
              db.run(
                `UPDATE users
                 SET total_points = total_points - ?
                 WHERE guild_id=? AND user_id=? AND total_points >= ?`,
                [fee, giveaway.guild_id, userId, fee],
                (e, r) => resolve(e ? null : r)
              );
            });

            if (!result) continue;

            await new Promise(resolve => {
              db.run(
                `INSERT INTO giveaway_entries
                 (giveaway_id,user_id,joined_at)
                 VALUES (?,?,?)
                 ON CONFLICT (giveaway_id,user_id) DO NOTHING`,
                [giveaway.id, userId, Date.now()],
                () => resolve()
              );
            });

            paidUsers.push(userId);

          } catch (err) {
            console.error(
              "❌ FORCED GIVEAWAY FEE ERROR:",
              giveaway.id,
              userId,
              err.message
            );
          }
        }

        users = paidUsers;
      }


    } else {

      const entries = await new Promise(resolve=>{
        db.all(
          "SELECT user_id FROM giveaway_entries WHERE giveaway_id=?",
          [giveaway.id],
          (e,r)=>resolve(r || [])
        );
      });

      users = entries.map(e=>e.user_id);

      // إعادة فحص الرتبة قبل اختيار الفائزين
      // إذا كان السحب يتطلب رتبة، لا يدخل القرعة إلا من يملكها حاليًا
      if (giveaway.role_id) {

        const guild = await client.guilds.fetch(giveaway.guild_id)
          .catch(() => null);

        if (!guild) {
          console.error("❌ ROLE CHECK GUILD ERROR:", giveaway.guild_id);
          processing.delete(giveaway.id);
          continue;
        }

        const eligibleUsers = [];

        for (const userId of users) {

          const member = await guild.members.fetch(userId)
            .catch(() => null);

          if (
            member &&
            member.roles.cache.has(giveaway.role_id)
          ) {
            eligibleUsers.push(userId);
          }
        }

        users = eligibleUsers;
      }

    }


    if(!users.length){

      const channel = await client.channels.fetch(giveaway.channel_id)
      .catch(()=>null);

      if(channel){
        channel.send(
`⚠️ انتهى السحب

🎁 الجائزة: ${giveaway.prize}

لم يتم العثور على مشاركين مؤهلين.`
        );
      }

      db.run(
        "UPDATE giveaways SET status='completed' WHERE id=?",
        [giveaway.id]
      );

      processing.delete(giveaway.id);
      continue;
    }

    if(users.length){

      const winners=[];

      while(
        winners.length < giveaway.winners_count &&
        users.length
      ){

        const i=Math.floor(Math.random()*users.length);
        winners.push(users[i]);
        users.splice(i,1);

      }

      const channel = await client.channels.fetch(giveaway.channel_id)
      .catch(()=>null);

      for(const winner of winners){

        db.run(
          "INSERT INTO giveaway_winners (giveaway_id,user_id,created_at) VALUES (?,?,?)",
          [giveaway.id,winner,Date.now()]
        );

      }

      if(channel){

        channel.send(
`🏆 **انتهى السحب**

🎁 الجائزة: ${giveaway.prize}

الفائزون:
${winners.map(id=>`<@${id}>`).join(", ")}`
        );

      }

    }

    db.run(
      "UPDATE giveaways SET status='completed' WHERE id=?",
      [giveaway.id]
    );

    processing.delete(giveaway.id);

   }

  });

 };
