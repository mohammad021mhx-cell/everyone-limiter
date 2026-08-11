const express = require("express");

const router = express.Router();

const DISCORD_API = "https://discord.com/api/v10";

async function discordRequest(url, options = {}) {
  const response = await fetch(DISCORD_API + url, options);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || `Discord API error ${response.status}`);
  }

  return data;
}

// بدء تسجيل الدخول عبر Discord
router.get("/auth/discord", (req, res) => {
  const redirectUri =
    process.env.REDIRECT_URI ||
    `${req.protocol}://${req.get("host")}/auth/discord/callback`;

  const params = new URLSearchParams({
    client_id: process.env.CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "identify guilds"
  });

  res.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
});

// Discord يرجع المستخدم لهنا
router.get("/auth/discord/callback", async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).send("❌ لم يتم استلام كود تسجيل الدخول.");
    }

    const redirectUri =
      process.env.REDIRECT_URI ||
      `${req.protocol}://${req.get("host")}/auth/discord/callback`;

    const tokenResponse = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri
      })
    });

    const token = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error("DISCORD TOKEN ERROR:", token);
      return res.status(401).send("❌ فشل تسجيل الدخول عبر Discord.");
    }

    const user = await discordRequest("/users/@me", {
      headers: {
        Authorization: `Bearer ${token.access_token}`
      }
    });

    req.session.regenerate(err => {
      if (err) {
        console.error("SESSION ERROR:", err);
        return res.status(500).send("❌ حدث خطأ في الجلسة.");
      }

      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.accessToken = token.access_token;
      req.session.refreshToken = token.refresh_token;
      req.session.lastActivity = Date.now();

      req.session.save(saveErr => {
        if (saveErr) {
          console.error("SESSION SAVE ERROR:", saveErr);
          return res.status(500).send("❌ حدث خطأ أثناء حفظ الجلسة.");
        }

        res.redirect("/");
      });
    });

  } catch (err) {
    console.error("DISCORD OAUTH ERROR:", err);
    res.status(500).send("❌ حدث خطأ أثناء تسجيل الدخول.");
  }
});

module.exports = router;
