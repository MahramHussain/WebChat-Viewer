import React, { useState } from 'react';
import { File } from 'lucide-react';
import WaveAudioPlayer from './WaveAudioPlayer';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';

export default function MessageBubble({ msg, isOut, isHighlighted, searchQuery, R2_URL }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const renderTextContent = (text) => {
    if (!text) return null;
    
    // 1. Split by URLs
    const urlRegex = /((?:https?:\/\/|www\.)[^\s<]+)/gi;
    const parts = text.split(urlRegex);
    
    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        const href = part.startsWith('www.') ? 'https://' + part : part;
        return <a key={i} href={href} target="_blank" rel="noopener noreferrer" style={{color:'#53bdeb', wordBreak:'break-all'}}>{part}</a>;
      } else {
        // Not a URL, now highlight search queries
        if (searchQuery && searchQuery.trim()) {
          const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const searchParts = part.split(new RegExp(`(${escapedQuery})`, 'gi'));
          return searchParts.map((sp, j) => 
            sp.toLowerCase() === searchQuery.toLowerCase() 
              ? <mark key={`${i}-${j}`} style={{ 
                  backgroundColor: isHighlighted ? '#ff9800' : '#ffeb3b', 
                  color: '#000', 
                  padding: '0 2px', 
                  borderRadius: '2px',
                  boxShadow: isHighlighted ? '0 0 0 2px rgba(255,152,0,0.5)' : 'none',
                  transition: 'background-color 0.3s ease, box-shadow 0.3s ease'
                }}>{sp}</mark> 
              : <React.Fragment key={`${i}-${j}`}>{sp}</React.Fragment>
          );
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      }
    });
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
      default: return <div className="text-content" style={{ whiteSpace: 'pre-wrap' }}>{renderTextContent(msg.content)}</div>;
    }
  };

  const isMediaOnly = msg.type === 'image' || msg.type === 'video' || msg.type === 'video_note' || msg.type === 'sticker';
  const isAudio = msg.type === 'audio';

  return (
    <div className={`message-bubble ${isHighlighted ? 'highlighted' : ''} ${isMediaOnly ? 'media-only' : ''} ${isAudio ? 'bubble-audio' : ''}`}>
      {renderBubbleContent()}
      {msg.type !== 'sticker' && (
        <span className={`message-time ${msg.type === 'video_note' || msg.type === 'image' ? 'media-time' : ''}`}>
          {msg.timestamp.split(' ').slice(1).join(' ')}
        </span>
      )}
    </div>
  );
}
