const db = require("./database/connect");

module.exports = function(client){

 db.all(
  "SELECT * FROM giveaways WHERE status='active' AND run_at <= ?",
  [Date.now()],
  async (err, giveaways)=>{

   if(err) return console.error(err);

   for(const giveaway of giveaways){

    let users=[];

    if(giveaway.type === "forced"){

      const guild = await client.guilds.fetch(giveaway.guild_id);

      const members = await guild.members.fetch();

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

   }

  });

 };
