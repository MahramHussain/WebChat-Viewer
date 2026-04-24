import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { ArrowLeft, Search, ChevronUp, ChevronDown, Calendar, UploadCloud } from 'lucide-react';
import MessageBubble from './MessageBubble';
import { formatNiceDate } from '../utils';

export default function ChatArea({ isMobile, activeChat, setActiveChat, messages, loading, setUploadOpen, R2_URL }) {
  const virtuosoRef = useRef(null);

  const NAMES_ME = ["Secretive Person", "Jafrin", "My Moon ❤️", "My Love ❤️", "My everything ❤️", "My Wife ❤️"];
  const NAMES_MAHRAM = ["Mahram", "Daddy ❤️", "My Sunny ❤️", "My Husband ❤️"];

  const [indexMe, setIndexMe] = useState(() => parseInt(localStorage.getItem('nameIndex_me')) || 0);
  const [indexMahram, setIndexMahram] = useState(() => parseInt(localStorage.getItem('nameIndex_mahram')) || 0);

  useEffect(() => localStorage.setItem('nameIndex_me', indexMe.toString()), [indexMe]);
  useEffect(() => localStorage.setItem('nameIndex_mahram', indexMahram.toString()), [indexMahram]);

  const handlePfpClick = (isOut, sender) => {
    if (isOut) setIndexMe((prev) => (prev + 1) % NAMES_ME.length);
    else if (sender === 'Mahram' || sender === 'م ح') setIndexMahram((prev) => (prev + 1) % NAMES_MAHRAM.length);
  };

  const getProfilePic = (isOut, sender) => {
    if (isOut) return `${R2_URL}profile_me.jpg`;
    if (sender === 'Mahram' || sender === 'م ح') return `${R2_URL}profile_mahram.jpg`;
    return `https://i.pravatar.cc/150?u=${encodeURIComponent(sender)}`;
  };

  const getUsernameTag = (isOut, sender) => {
    if (isOut) return NAMES_ME[indexMe];
    if (sender === 'Mahram' || sender === 'م ح') return NAMES_MAHRAM[indexMahram];
    return sender;
  };

  // Search
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatches, setSearchMatches] = useState([]);
  const [currentMatchIdx, setCurrentMatchIdx] = useState(-1);

  // Date Menu
  const [dateMenuOpen, setDateMenuOpen] = useState(false);

  // Floating Date
  const [topIndex, setTopIndex] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const [showFloatingDate, setShowFloatingDate] = useState(false);
  const scrollingTimeout = useRef(null);

  useEffect(() => {
    if (messages.length) {
      setTimeout(() => {
        virtuosoRef.current?.scrollToIndex({ index: messages.length - 1, align: 'end', behavior: 'auto' });
      }, 100);
    }
  }, [messages.length]);

  useEffect(() => {
    if (!searchQuery) {
      setSearchMatches([]);
      setCurrentMatchIdx(-1);
      return;
    }
    const q = searchQuery.toLowerCase();
    const matches = messages
      .map((m, idx) => (m.content && m.content.toLowerCase().includes(q) ? idx : -1))
      .filter((i) => i !== -1);

    setSearchMatches(matches);
    if (matches.length > 0) {
      setCurrentMatchIdx(matches.length - 1);
      jumpToSearchIdx(matches.length - 1, matches);
    } else {
      setCurrentMatchIdx(-1);
    }
  }, [searchQuery, messages]);

  const jumpToSearchIdx = (matchListIdx, matches = searchMatches) => {
    const virtualIdx = matches[matchListIdx];
    if (virtualIdx !== undefined && virtuosoRef.current) {
      virtuosoRef.current.scrollToIndex({ index: virtualIdx, align: 'center', behavior: 'smooth' });
    }
  };

  const dateIndexes = useMemo(() => {
    const dates = [];
    if (!messages.length) return dates;
    let lastDate = null;
    messages.forEach((msg, idx) => {
      const msgDate = msg.timestamp.split(' ')[0];
      if (msgDate !== lastDate) {
        dates.push({ label: formatNiceDate(msgDate), index: idx });
        lastDate = msgDate;
      }
    });
    return dates;
  }, [messages]);

  const handleScrollState = useCallback((scrolling) => {
    setIsScrolling(scrolling);
    if (scrolling) {
      if (scrollingTimeout.current) clearTimeout(scrollingTimeout.current);
      setShowFloatingDate(true);
    } else {
      scrollingTimeout.current = setTimeout(() => {
        setShowFloatingDate(false);
      }, 1500); // hide after 1.5 seconds of stopping
    }
  }, []);

  if (!activeChat) {
    return (
      <div className="main-chat" style={{ display: isMobile ? 'none' : 'flex' }}>
        <div className="empty-state">
          <h1>Welcome Home</h1>
          <p>Select a chat to begin browsing history</p>
        </div>
      </div>
    );
  }

  const floatingDateString = messages[topIndex] ? formatNiceDate(messages[topIndex].timestamp.split(' ')[0]) : '';

  return (
    <div className="main-chat" style={{ display: isMobile ? 'flex' : 'flex' }}>

      <div className="chat-header">
        {isMobile && (
          <ArrowLeft size={24} style={{ marginRight: '15px', cursor: 'pointer', flexShrink: 0 }} onClick={() => setActiveChat(null)} />
        )}
        <img src={activeChat.img} alt={activeChat.name} className="chat-avatar" style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0, paddingRight: '10px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeChat.name}</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{messages.length.toLocaleString()} messages</p>
        </div>

        <div className="fab-top-group">
          <div className="fab-top" onClick={() => setUploadOpen(true)}>
            <UploadCloud size={isMobile ? 18 : 20} />
          </div>
          <div className="fab-top" onClick={() => setSearchOpen(!searchOpen)}>
            <Search size={isMobile ? 18 : 20} />
          </div>
          <div className="fab-top" onClick={() => virtuosoRef.current?.scrollToIndex({ index: 0, align: 'start', behavior: 'smooth' })}>
            <ChevronUp size={isMobile ? 20 : 22} />
          </div>
          <div className="fab-top" onClick={() => setDateMenuOpen(!dateMenuOpen)} style={{ backgroundColor: dateMenuOpen ? '#005c4b' : '', color: dateMenuOpen ? 'white' : '' }}>
            <Calendar size={isMobile ? 16 : 18} />
          </div>
        </div>
      </div>

      {showFloatingDate && floatingDateString && (
        <div className="floating-date-chip">
          {floatingDateString}
        </div>
      )}

      <div className={`in-chat-search ${searchOpen ? 'visible' : ''}`}>
        <input
          type="text"
          placeholder="Find in chat..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          autoFocus={searchOpen}
        />
        <span className="search-count">
          {searchMatches.length > 0 ? `${currentMatchIdx + 1}/${searchMatches.length}` : '0/0'}
        </span>
        <button className="icon-btn-small" onClick={() => { if (currentMatchIdx > 0) { setCurrentMatchIdx(prev => prev - 1); jumpToSearchIdx(currentMatchIdx - 1); } }}>
          <ChevronUp size={18} />
        </button>
        <button className="icon-btn-small" onClick={() => { if (currentMatchIdx < searchMatches.length - 1) { setCurrentMatchIdx(prev => prev + 1); jumpToSearchIdx(currentMatchIdx + 1); } }}>
          <ChevronDown size={18} />
        </button>
      </div>

      <div className="messages-container-wrapper">
        {loading && <div className="loader"></div>}
        {!loading && (
          <Virtuoso
            ref={virtuosoRef}
            style={{ height: '100%', width: '100%' }}
            data={messages}
            initialTopMostItemIndex={messages.length - 1}
            isScrolling={handleScrollState}
            rangeChanged={(range) => setTopIndex(range.startIndex)}
            itemContent={(index, msg) => {
              let showDate = false;
              let msgDate = msg.timestamp.split(' ')[0];
              if (index === 0) showDate = true;
              else {
                const prevDate = messages[index - 1]?.timestamp.split(' ')[0];
                if (msgDate !== prevDate) showDate = true;
              }

              const niceDateString = formatNiceDate(msgDate);

              if (msg.type === 'system') {
                return (
                  <div style={{ paddingBottom: '8px' }}>
                    {showDate && <div className="date-divider">{niceDateString}</div>}
                    <div className="system-message">{msg.content}</div>
                  </div>
                );
              }

              const isOut = ['You', 'Secretive Person', 'Jafrin'].includes(msg.sender);
              const isHighlighted = searchMatches[currentMatchIdx] === index;

              return (
                <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: '8px' }}>
                  {showDate && <div className="date-divider">{niceDateString}</div>}

                  <div className={`message-row ${isOut ? 'out' : 'in'} ${msg.type === 'sticker' || msg.type === 'video_note' ? 'clear-bg' : ''}`} style={{ marginBottom: 0 }}>
                    <img
                      src={getProfilePic(isOut, msg.sender)}
                      className="message-pfp"
                      alt="profile"
                      onClick={() => handlePfpClick(isOut, msg.sender)}
                      style={{ cursor: 'pointer' }}
                      onError={(e) => { e.target.style.display = 'none' }}
                    />

                    <div className="message-content-wrapper">
                      <span className="username-tag" style={{ color: isOut ? 'var(--accent-green)' : '#d864d8' }}>
                        {getUsernameTag(isOut, msg.sender)}
                      </span>

                      <MessageBubble msg={msg} isOut={isOut} isHighlighted={isHighlighted} R2_URL={R2_URL} />
                    </div>
                  </div>
                </div>
              );
            }}
          />
        )}
      </div>

      <div className={`date-menu ${!dateMenuOpen ? 'hidden' : ''}`}>
        {dateIndexes.map(item => (
          <div key={item.index} className="date-link" onClick={() => {
            virtuosoRef.current?.scrollToIndex({ index: item.index, align: 'start', behavior: 'smooth' });
            setDateMenuOpen(false);
          }}>
            {item.label}
          </div>
        ))}
      </div>

      <div className="fab-bottom" onClick={() => virtuosoRef.current?.scrollToIndex({ index: messages.length - 1, align: 'start', behavior: 'smooth' })}>
        <ChevronDown size={24} />
      </div>
    </div>
  );
}
