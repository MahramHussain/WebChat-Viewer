const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'chat.db');

const db = require('./db.js');

const CLOUD_URL = "https://pub-a07443f8cdb140edb1b5ed863a70c0a4.r2.dev/";
const FOLDERS = {
    images: "images",
    audios: "audios",
    stickers: "stickers",
    documents: "documents",
    videos: "videos"
};

const CHATS = [
    { id: "chat1", name: "م ج", file: "chat1.txt", video_folder: "video_notes_1", subtitle: "My love and I", img: "group_header.jpg" },
    { id: "chat2", name: "ƚαx", file: "chat2.txt", video_folder: "video_notes_2", subtitle: "Fuck Taxation", img: "group_header_2.jpg" },
    { id: "chat3", name: "Mahram", file: "chat3.txt", video_folder: "video_notes_3", subtitle: "Forever Online", img: "profile_mahram.jpg" }
];

const MSG_PATTERN = /^(\d{1,2}\/\d{1,2}\/\d{2,4}),\s+(\d{1,2}:\d{2})(?:\s*(am|pm|AM|PM))?\s+-\s+(.*?):\s*(.*)/i;
const SYS_PATTERN = /^(\d{1,2}\/\d{1,2}\/\d{2,4}),\s+(\d{1,2}:\d{2})(?:\s*(am|pm|AM|PM))?\s+-\s+(.*)/i;

db.exec('BEGIN TRANSACTION;');
db.exec('DELETE FROM messages;');
db.exec('DELETE FROM chats;');

const insertChat = db.prepare('INSERT OR IGNORE INTO chats (id, name, subtitle, img) VALUES (?, ?, ?, ?)');
const insertMsg = db.prepare(`
    INSERT INTO messages (chat_id, sender, content, type, timestamp, media_url) 
    VALUES (?, ?, ?, ?, ?, ?)
`);

for (const chat of CHATS) {
    const chatImgUrl = chat.img.startsWith('http') ? chat.img : CLOUD_URL + chat.img;
    insertChat.run(chat.id, chat.name, chat.subtitle, chatImgUrl);

    const txtPath = path.join(__dirname, '..', chat.file);
    if (!fs.existsSync(txtPath)) {
        console.log(`⚠️  Skipping ${txtPath} (Not found)`);
        continue;
    }

    const lines = fs.readFileSync(txtPath, 'utf8').split('\n');
    console.log(`📂 Parsing ${lines.length} lines from ${chat.file}...`);

    const videoNoteDir = path.join(__dirname, '..', chat.video_folder);
    let videoNotes = [];
    if (fs.existsSync(videoNoteDir)) {
        videoNotes = fs.readdirSync(videoNoteDir)
            .filter(f => /\.(mp4|webm|mov)$/i.test(f))
            .sort()
            .map(f => `${chat.video_folder}/${f}`);
    }
    let videoNoteIndex = 0;

    let currentMsg = null;

    const commitMessage = () => {
        if (!currentMsg) return;
        
        let type = 'text';
        let mediaUrl = null;
        let finalContent = currentMsg.content.trim();
        const cleanMsg = finalContent.replace(/[^\w\s]/g, '').toLowerCase();

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

        insertMsg.run(
            chat.id, 
            currentMsg.sender, 
            finalContent, 
            type, 
            currentMsg.timestamp, 
            mediaUrl
        );
        currentMsg = null;
    };

    for (const line of lines) {
        const raw = line.trim();
        if (!raw) continue;

        let m = raw.match(MSG_PATTERN);
        if (m) {
            commitMessage(); 
            const date = m[1];
            const time = m[2];
            const ampm = m[3] || '';
            const sender = m[4];
            const msgContent = m[5];

            const displayTime = ampm ? `${time} ${ampm}`.trim() : time;
            const fullTimestamp = `${date} ${displayTime}`;
            
            if (msgContent.trim()) {
                currentMsg = {
                    sender: sender,
                    content: msgContent,
                    timestamp: fullTimestamp
                };
            }
            continue;
        }

        let s = raw.match(SYS_PATTERN);
        if (s) {
            commitMessage(); 
            const date = s[1];
            const time = s[2];
            const ampm = s[3] || '';
            const text = s[4];
            
            const displayTime = ampm ? `${time} ${ampm}`.trim() : time;
            const fullTimestamp = `${date} ${displayTime}`;
            insertMsg.run(chat.id, 'SYSTEM', text, 'system', fullTimestamp, null);
            continue;
        }

        // Multiline support: If it doesn't match standard prefixes, it's a newline of the prev message
        if (currentMsg) {
            currentMsg.content += '\n' + raw;
        }
    }
    commitMessage(); 
}
db.exec('COMMIT;');
console.log('✅ Migration complete with full Multi-line Support! SQLite database created.');
