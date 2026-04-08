const mysql = require("mysql2");
const axios = require("axios");

const BOT_TOKEN = "8272539016:AAH_rzqcDH2PX3mJnVoIWDTbUA-tDENM8Eo";
const CHAT_ID = "8272539016";

// DB connect
const db = mysql.createConnection({
  host: "sql205.infinityfree.com",
  user: "if0_41355002",
  password: "AnimePlex20q",
  database: "if0_41355002_aprp"
});

// Track last sent
let lastId = 0;

// Check DB every 5 sec
setInterval(() => {

  db.query("SELECT * FROM requests ORDER BY id DESC LIMIT 1", (err, rows) => {
    if (err) return console.log(err);

    if (rows.length > 0) {
      let req = rows[0];

      if (req.id > lastId) {
        lastId = req.id;

        let msg = `🚀 New Request\n\nID: ${req.id}\nType: ${req.type}\nTitle: ${req.title}\nUser: ${req.user_name}`;

        axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          params: {
            chat_id: CHAT_ID,
            text: msg
          }
        });
      }
    }
  });

}, 5000);