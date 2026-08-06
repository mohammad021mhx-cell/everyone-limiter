const session = require("express-session");

module.exports = session({
  secret: process.env.SESSION_SECRET || "md-points-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 86400000
  }
});
