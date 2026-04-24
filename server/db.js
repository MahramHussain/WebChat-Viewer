const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Where Railway expects the DB vs where it is on your local PC
const localDbPath = path.join(__dirname, 'chat.db');
const dbPath = process.env.DB_PATH || localDbPath;

// 🔴 THE AUTO-COPY TRICK
// If we are on Railway (DB_PATH exists) and we have your actual chat.db uploaded...
if (process.env.DB_PATH && fs.existsSync(localDbPath)) {
    let shouldCopy = false;
    
    // If the volume has no file yet, or if it's a blank auto-generated database (under 50KB)
    if (!fs.existsSync(dbPath)) {
        shouldCopy = true;
    } else {
        const stats = fs.statSync(dbPath);
        if (stats.size < 50000) { // 50KB means it's practically empty
            shouldCopy = true;
        }
    }

    if (shouldCopy) {
        console.log("Volume DB is empty! Injecting your local chat.db...");
        
        // Copy main database
        fs.copyFileSync(localDbPath, dbPath);
        
        // Copy WAL file if it exists
        const localWal = localDbPath + '-wal';
        const volWal = dbPath + '-wal';
        if (fs.existsSync(localWal)) {
            fs.copyFileSync(localWal, volWal);
            console.log("✅ Copied WAL file");
        }

        // Copy SHM file if it exists
        const localShm = localDbPath + '-shm';
        const volShm = dbPath + '-shm';
        if (fs.existsSync(localShm)) {
            fs.copyFileSync(localShm, volShm);
            console.log("✅ Copied SHM file");
        }

        console.log("✅ Entire database injected successfully!");
    }
}

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