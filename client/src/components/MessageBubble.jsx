import React, { useState } from 'react';
import { File } from 'lucide-react';
import WaveAudioPlayer from './WaveAudioPlayer';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';

export default function MessageBubble({ msg, isOut, isHighlighted, searchQuery, R2_URL }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const linkifyAndHighlight = (html) => {
    let text = html || '';

    // 1. Linkify URLs
    text = text.replace(
      /((?:https?:\/\/|www\.)[^\s<]+)/gi,
      (url) => {
        const href = url.startsWith('www.') ? 'https://' + url : url;
        return `<a href="${href}" target="_blank" rel="noopener noreferrer" style="color:#53bdeb;word-break:break-all;">${url}</a>`;
      }
    );

    // 2. Highlight the search query (ONLY OUTSIDE HTML TAGS)
    if (searchQuery && searchQuery.trim() !== '') {
      const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Match the query only if it's not inside an HTML tag.
      const regex = new RegExp(`(${escapedQuery})(?![^<]*>)`, 'gi');
      text = text.replace(regex, '<mark style="background-color: #ffeb3b; color: #000; padding: 0 2px; border-radius: 2px;">$1</mark>');
    }

    return text;
  };
  const renderBubbleContent = () => {
    switch (msg.type) {
      case 'image': 
        return (
          <>
            <img 
              src={msg.media_url} 
              className="media-image" 
              alt="chat-img" 
              onClick={() => setLightboxOpen(true)}
              style={{ cursor: 'pointer' }}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
            {lightboxOpen && (
              <Lightbox
                open={lightboxOpen}
                close={() => setLightboxOpen(false)}
                slides={[{ src: msg.media_url }]}
                carousel={{ finite: true }}
                controller={{ closeOnBackdropClick: true }}
              />
            )}
          </>
        );
      case 'video': return <video src={msg.media_url} className="media-video" controls muted playsInline preload="none" />;
      case 'audio': return <WaveAudioPlayer url={msg.media_url} isOut={isOut} msg={msg} R2_URL={R2_URL} />;
      case 'sticker': return <img src={msg.media_url} className="media-sticker" alt="sticker" onError={(e) => { e.target.style.display = 'none'; }} />;
      case 'document':
        return (
          <a href={msg.media_url} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
            <div className="doc-card">
              <File size={24} style={{ marginRight: '10px' }} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span className="doc-name">{msg.content}</span>
                <span style={{ fontSize: '11px', opacity: 0.7 }}>CLICK TO OPEN</span>
              </div>
            </div>
          </a>
        );
      case 'video_note': return <video src={msg.media_url} className="media-video-note" controls muted playsInline preload="none" />;
      default: return <div className="text-content" dangerouslySetInnerHTML={{ __html: linkifyAndHighlight(msg.content || '') }} />;
    }
  };

  return (
    <div className={`message-bubble ${isHighlighted ? 'highlighted' : ''}`}>
      {renderBubbleContent()}
      {msg.type !== 'sticker' && (
        <span className={`message-time ${msg.type === 'video_note' || msg.type === 'image' ? 'media-time' : ''}`}>
          {msg.timestamp.split(' ').slice(1).join(' ')}
        </span>
      )}
    </div>
  );
}
