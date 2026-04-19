const Database = require('better-sqlite3');
const path = require('path');

// 🔴 CHANGED: Looks for Railway's DB_PATH first, falls back to local 'chat.db' for testing
const dbPath = process.env.DB_PATH || path.join(__dirname, 'chat.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    subtitle TEXT,
    img TEXT
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id TEXT NOT NULL,
    sender TEXT NOT NULL,
    content TEXT,
    type TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    media_url TEXT,
    FOREIGN KEY(chat_id) REFERENCES chats(id)
  );
`);

module.exports = db;