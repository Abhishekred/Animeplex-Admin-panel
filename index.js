const express = require("express");
const axios = require("axios");
const mysql = require("mysql2");

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 🔐 ENV VARIABLES
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

// 🗄️ DB (Railway auto variables)
const db = mysql.createConnection({
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE
});

// Auto table create
db.query(`
CREATE TABLE IF NOT EXISTS requests (
 id INT AUTO_INCREMENT PRIMARY KEY,
 type VARCHAR(50),
 name VARCHAR(100),
 title VARCHAR(255),
 status VARCHAR(20) DEFAULT 'pending'
)
`);

// 🎨 UI
app.get("/", (req, res) => {

  db.query("SELECT * FROM requests ORDER BY id DESC", (err, rows) => {

    if(err) return res.send("DB Error");

    let list = rows.map(r => `
      <div style="background:#222;padding:10px;margin:10px;border-radius:8px;">
        <b>${r.title}</b><br>
        ${r.type} | ${r.name}<br>
        Status: <b>${r.status}</b>
      </div>
    `).join("");

    res.send(`
    <html>
    <head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
    body{background:#000;color:white;font-family:Arial;padding:20px;}
    .box{max-width:400px;margin:auto;background:#111;padding:20px;border-radius:10px;}
    input,select{width:100%;padding:10px;margin:10px 0;border:none;border-radius:5px;}
    button{background:#e50914;color:white;padding:10px;border:none;border-radius:5px;width:100%;}
    </style>
    </head>
    <body>

    <div class="box">
    <h2>🎬 Request Content</h2>

    <form method="POST" action="/request">
    <select name="type">
    <option>Movie</option>
    <option>Anime</option>
    <option>Web Series</option>
    </select>

    <input name="name" placeholder="Your Name" required>
    <input name="title" placeholder="Title" required>

    <button>Send Request</button>
    </form>

    <h3>📋 All Requests</h3>
    ${list}

    </div>
    </body>
    </html>
    `);
  });
});

// 🚀 SAVE REQUEST
app.post("/request", async (req, res) => {
  const { type, name, title } = req.body;

  db.query(
    "INSERT INTO requests (type, name, title) VALUES (?, ?, ?)",
    [type, name, title],
    async (err, result) => {

      if(err) return res.send("DB Insert Error");

      let id = result.insertId;

      let msg = `🚀 New Request
ID: ${id}
Type: ${type}
Title: ${title}
User: ${name}

Commands:
/accept ${id}
/done ${id}
/cancel ${id}`;

      try{
        await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          params: { chat_id: CHAT_ID, text: msg }
        });
      }catch(e){
        console.log("Telegram Error");
      }

      res.redirect("/");
    }
  );
});

// 🤖 TELEGRAM WEBHOOK
app.post("/bot", (req, res) => {

  const msg = req.body.message?.text || "";

  let match;

  if(match = msg.match(/\/accept (\d+)/)){
    db.query("UPDATE requests SET status='accepted' WHERE id=?", [match[1]]);
  }

  if(match = msg.match(/\/done (\d+)/)){
    db.query("UPDATE requests SET status='done' WHERE id=?", [match[1]]);
  }

  if(match = msg.match(/\/cancel (\d+)/)){
    db.query("UPDATE requests SET status='cancelled' WHERE id=?", [match[1]]);
  }

  res.send("ok");
});

// 🚀 START (IMPORTANT FIX)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🔥 Server Running on " + PORT));