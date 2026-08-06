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

        members = await guild.members.fetch();

  
      } catch(err){

        console.error("MEMBERS FETCH ERROR:", err.message);
        continue;

      }

      users = members
      .filter(m => m.roles.cache.has(giveaway.role_id))
      .map(m=>m.id);


    } else {

      const entries = await new Promise(resolve=>{
        db.all(
          "SELECT user_id FROM giveaway_entries WHERE giveaway_id=?",
          [giveaway.id],
          (e,r)=>resolve(r || [])
        );
      });

      users = entries.map(e=>e.user_id);

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
