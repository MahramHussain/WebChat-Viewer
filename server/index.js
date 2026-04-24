const express = require('express');
const cors = require('cors');
const db = require('./db.js');
const busboy = require('busboy');
const readline = require('readline');

const app = express();

// 🔴 THE NUKE: Hardcoding the exact allowed websites. 
// It will now accept requests from your local machine AND your exact Cloudflare production link.
app.use(cors({
    origin: ['http://localhost:5173', 'https://mxj.pages.dev'],
    credentials: true
}));

app.use(express.json());
// Remove standard text limit or keep small for JSON
app.use(express.text({ limit: '50mb' }));

const fs = require('fs');
const path = require('path');
const CLOUD_URL = "https://pub-a07443f8cdb140edb1b5ed863a70c0a4.r2.dev/";
const FOLDERS = {
    images: "images", audios: "audios", stickers: "stickers",
    documents: "documents", videos: "videos"
};
const MSG_PATTERN = /^(\d{1,2}\/\d{1,2}\/\d{2,4}),\s+(\d{1,2}:\d{2})(?:\s*(am|pm|AM|PM))?\s+-\s+(.*?):\s*(.*)/i;
const SYS_PATTERN = /^(\d{1,2}\/\d{1,2}\/\d{2,4}),\s+(\d{1,2}:\d{2})(?:\s*(am|pm|AM|PM))?\s+-\s+(.*)/i;

// Post Pin Verification
const PASSCODE = process.env.PASSCODE || "1011";
app.post('/api/verify-pin', (req, res) => {
  const { pin } = req.body;
  if (pin === PASSCODE) {
    res.json({ success: true, message: "Unlocked successfully" });
  } else {
    res.status(401).json({ success: false, error: "Invalid pin" });
  }
});

// Get all chats
app.get('/api/chats', (req, res) => {
  try {
    const chats = db.prepare('SELECT * FROM chats').all();
    res.json(chats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get messages for a specific chat with offset pagination
app.get('/api/chats/:id/messages', (req, res) => {
  const { id } = req.params;
  const { limit = 1000, offset = 0 } = req.query;

  try {
    const messages = db.prepare(`
      SELECT * FROM messages 
      WHERE chat_id = ? 
      ORDER BY id DESC 
      LIMIT ? OFFSET ?
    `).all(id, parseInt(limit), parseInt(offset));
    res.json(messages.reverse());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Drag and Drop Upload Endpoint (Deduplicated, Streaming Upload)
app.post('/api/upload-chat', (req, res) => {
  const { chatId, videoFolder } = req.query;
  if (!chatId) return res.status(400).json({ error: "Missing chatId" });

  const bb = busboy({ headers: req.headers });

  let newInserts = 0;
  let hasError = false;

  const existingRows = db.prepare('SELECT sender, timestamp FROM messages WHERE chat_id = ?').all(chatId);
  const existingRecords = new Set();
  existingRows.forEach(row => existingRecords.add(`${row.sender}|||${row.timestamp}`));

  let videoNotes = [];
  if (videoFolder) {
    const videoNoteDir = path.join(__dirname, '..', videoFolder);
    if (fs.existsSync(videoNoteDir)) {
      videoNotes = fs.readdirSync(videoNoteDir)
        .filter(f => /\.(mp4|webm|mov)$/i.test(f))
        .sort()
        .map(f => `${videoFolder}/${f}`);
    }
  }
  let videoNoteIndex = 0;

  const insertMsg = db.prepare(`
    INSERT INTO messages (chat_id, sender, content, type, timestamp, media_url) 
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  let currentMsg = null;
  db.exec('BEGIN TRANSACTION;');

  const commitMessage = () => {
    if (!currentMsg) return;
    const hash = `${currentMsg.sender}|||${currentMsg.timestamp}`;
    if (existingRecords.has(hash)) {
       currentMsg = null; return;
    }
    existingRecords.add(hash);

    let type = 'text';
    let mediaUrl = null;
    let finalContent = currentMsg.content.trim();
    const cleanMsg = finalContent.replace(/[^\w\s]/g, '').toLowerCase();

    finalContent = finalContent.split('1 7').join('.');
    finalContent = finalContent.split(' .').join('.');
    finalContent = finalContent.split('➄.').join('.');
    finalContent = finalContent.split('ↄ.').join('.');

    if (cleanMsg.includes('video') && cleanMsg.includes('note') && cleanMsg.includes('omitted')) {
      type = 'video_note';
      finalContent = 'Video Note (omitted)';
      if (videoNoteIndex < videoNotes.length) {
        mediaUrl = `${CLOUD_URL}${videoNotes[videoNoteIndex]}`;
        videoNoteIndex++;
      }
    } else if (finalContent.toLowerCase().includes('.webp') && finalContent.includes('(file attached)')) {
      type = 'sticker';
      const filename = finalContent.replace('(file attached)', '').trim();
      mediaUrl = `${CLOUD_URL}${FOLDERS.stickers}/${filename}`;
      finalContent = '';
    } else if (finalContent.toLowerCase().includes('.opus') && finalContent.includes('(file attached)')) {
      type = 'audio';
      const filename = finalContent.replace('(file attached)', '').trim();
      mediaUrl = `${CLOUD_URL}${FOLDERS.audios}/${filename}`;
      finalContent = '';
    } else if (/\.(jpg|jpeg|png|gif)/i.test(finalContent) && finalContent.includes('(file attached)')) {
      type = 'image';
      const filename = finalContent.replace('(file attached)', '').trim();
      mediaUrl = `${CLOUD_URL}${FOLDERS.images}/${filename}`;
      finalContent = '';
    } else if (/\.(mp4|mov|m4v)/i.test(finalContent) && finalContent.includes('(file attached)') && !cleanMsg.includes('video note')) {
      type = 'video';
      const filename = finalContent.replace('(file attached)', '').trim();
      mediaUrl = `${CLOUD_URL}${FOLDERS.videos}/${filename}`;
      finalContent = '';
    } else if (finalContent.includes('(file attached)')) {
      type = 'document';
      const filename = finalContent.replace('(file attached)', '').trim().replace(/\.$/, '');
      mediaUrl = `${CLOUD_URL}${FOLDERS.documents}/${filename}`;
      finalContent = filename;
    }

    insertMsg.run(chatId, currentMsg.sender, finalContent, type, currentMsg.timestamp, mediaUrl);
    newInserts++;
    currentMsg = null;
  };

  bb.on('file', (name, file, info) => {
    const rl = readline.createInterface({ input: file, crlfDelay: Infinity });

    rl.on('line', (line) => {
      const raw = line.trim();
      if (!raw) return;

      let m = raw.match(MSG_PATTERN);
      if (m) {
        commitMessage(); 
        const date = m[1]; const time = m[2]; const ampm = m[3] || '';
        const sender = m[4]; const msgContent = m[5];

        const displayTime = ampm ? `${time} ${ampm}`.trim() : time;
        currentMsg = { sender, content: msgContent, timestamp: `${date} ${displayTime}` };
        return;
      }

      let s = raw.match(SYS_PATTERN);
      if (s) {
        commitMessage(); 
        const date = s[1]; const time = s[2]; const ampm = s[3] || '';
        const text = s[4];
        
        const displayTime = ampm ? `${time} ${ampm}`.trim() : time;
        const fullTimestamp = `${date} ${displayTime}`;
        
        const hash = `SYSTEM|||${fullTimestamp}`;
        if (!existingRecords.has(hash)) {
             insertMsg.run(chatId, 'SYSTEM', text, 'system', fullTimestamp, null);
             existingRecords.add(hash);
             newInserts++;
        }
        return;
      }

      if (currentMsg) {
        currentMsg.content += '\n' + raw;
      }
    });

    rl.on('close', () => {
      commitMessage();
    });
  });

  bb.on('close', () => {
    if (!hasError) {
      db.exec('COMMIT;');
      res.json({ success: true, message: `Successfully injected ${newInserts} new messages seamlessly!` });
    }
  });

  bb.on('error', (err) => {
    hasError = true;
    db.exec('ROLLBACK;');
    console.error("Injection error:", err);
    res.status(500).json({ error: "Database injection failed", details: err.message });
  });

  req.pipe(bb);
});

// ── Serve React frontend in production ──
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('/{*splat}', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Chat API Server running on port ${PORT}`);
});