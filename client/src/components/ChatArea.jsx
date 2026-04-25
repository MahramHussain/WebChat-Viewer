import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { Virtuoso } from 'react-virtuoso';
import { ArrowLeft, Search, ChevronUp, ChevronDown, Calendar, UploadCloud } from 'lucide-react';
import axios from 'axios';
import MessageBubble from './MessageBubble';
import { formatNiceDate } from '../utils';

const API_URL = import.meta.env.VITE_API_URL || '';
const CHUNK_SIZE = 500;

export default function ChatArea({ isMobile, activeChat, setActiveChat, setUploadOpen, R2_URL }) {
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

  // State
  const [messages, setMessages] = useState([]);
  const [totalMessages, setTotalMessages] = useState(0);
  const [firstItemIndex, setFirstItemIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isJumping, setIsJumping] = useState(false);
  const [pendingScroll, setPendingScroll] = useState(null);
  const isFetchingChunk = useRef(false);

  // Search
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatches, setSearchMatches] = useState([]);
  const [currentMatchIdx, setCurrentMatchIdx] = useState(-1);
  const searchTimeoutRef = useRef(null);

  // Date Menu
  const [dateMenuOpen, setDateMenuOpen] = useState(false);
  const [backendDates, setBackendDates] = useState([]);

  // Floating Date
  const [topIndex, setTopIndex] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const [showFloatingDate, setShowFloatingDate] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const scrollingTimeout = useRef(null);

  // Initialize Chat
  useEffect(() => {
    if (!activeChat) return;

    const initChat = async () => {
      setLoading(true);
      setMessages([]);
      setFirstItemIndex(0);
      setSearchQuery('');
      setSearchMatches([]);
      setCurrentMatchIdx(-1);
      setSearchOpen(false);
      setDateMenuOpen(false);

      try {
        const totalRes = await axios.get(`${API_URL}/api/chats/${activeChat.id}/total`);
        const total = totalRes.data.total;
        setTotalMessages(total);

        axios.get(`${API_URL}/api/chats/${activeChat.id}/dates`).then(res => {
          setBackendDates(res.data);
        }).catch(err => console.error("Failed to load dates", err));

        if (total > 0) {
          const initialOffset = Math.max(0, total - CHUNK_SIZE);
          const messagesRes = await axios.get(`${API_URL}/api/chats/${activeChat.id}/messages`, {
            params: { limit: CHUNK_SIZE, offset: initialOffset }
          });
          setFirstItemIndex(initialOffset);
          setMessages(messagesRes.data);
          
          setTimeout(() => {
            virtuosoRef.current?.scrollToIndex({ index: total - 1, align: 'end', behavior: 'auto' });
          }, 100);
        }
      } catch (err) {
        console.error("Initialization error", err);
      } finally {
        setLoading(false);
      }
    };

    initChat();
  }, [activeChat]);

  // Handle Search Input (Debounced)
  useEffect(() => {
    if (!searchQuery) {
      setSearchMatches([]);
      setCurrentMatchIdx(-1);
      return;
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await axios.get(`${API_URL}/api/chats/${activeChat.id}/search`, {
          params: { q: searchQuery }
        });
        const matches = res.data;
        setSearchMatches(matches);
        if (matches.length > 0) {
          setCurrentMatchIdx(matches.length - 1);
          jumpToIdx(matches[matches.length - 1], 'center');
        } else {
          setCurrentMatchIdx(-1);
        }
      } catch (err) {
        console.error("Search error", err);
      }
    }, 500);

    return () => clearTimeout(searchTimeoutRef.current);
  }, [searchQuery, activeChat]);

  const navigateSearch = (direction) => {
    if (searchMatches.length === 0) return;
    let newIdx = currentMatchIdx + direction;
    if (newIdx < 0) newIdx = 0;
    if (newIdx >= searchMatches.length) newIdx = searchMatches.length - 1;
    setCurrentMatchIdx(newIdx);
    jumpToIdx(searchMatches[newIdx], 'center');
  };

  // Jump to an index (chunked)
  const jumpToIdx = async (targetIdx, align = 'start') => {
    if (!activeChat) return;

    const isLoaded = targetIdx >= firstItemIndex && targetIdx < firstItemIndex + messages.length;

    if (isLoaded) {
      virtuosoRef.current?.scrollToIndex({ index: targetIdx, align, behavior: 'smooth' });
    } else {
      setIsJumping(true);
      try {
        const offset = align === 'start' ? Math.max(0, targetIdx - 10) : Math.max(0, targetIdx - Math.floor(CHUNK_SIZE / 2));
        const res = await axios.get(`${API_URL}/api/chats/${activeChat.id}/messages`, {
          params: { limit: CHUNK_SIZE, offset }
        });
        
        setFirstItemIndex(offset);
        setMessages(res.data);
        setPendingScroll({ index: targetIdx, align });
      } catch (err) {
        console.error("Jump error", err);
        setIsJumping(false);
      }
    }
  };

  useEffect(() => {
    if (pendingScroll !== null && messages.length > 0) {
      const timeoutId = setTimeout(() => {
        virtuosoRef.current?.scrollToIndex({ 
          index: pendingScroll.index, 
          align: pendingScroll.align, 
          behavior: 'auto' 
        });
        setPendingScroll(null);
        setIsJumping(false);
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [messages, pendingScroll]);

  // Infinite Scroll Callbacks
  const loadOlder = useCallback(async () => {
    if (!activeChat || firstItemIndex <= 0 || loading || isJumping || isFetchingChunk.current) return;
    
    isFetchingChunk.current = true;
    try {
      const offset = Math.max(0, firstItemIndex - CHUNK_SIZE);
      const limit = firstItemIndex - offset;
      if (limit <= 0) return;
      
      const res = await axios.get(`${API_URL}/api/chats/${activeChat.id}/messages`, {
        params: { limit, offset }
      });
      
      const newItems = res.data;
      if (newItems.length > 0) {
        // Use flushSync to guarantee React commits this in exactly one frame, preventing scroll jitter
        flushSync(() => {
          setFirstItemIndex(prev => prev - newItems.length);
          setMessages(prev => [...newItems, ...prev]);
        });
      }
    } catch (err) {
      console.error("Load older error", err);
    } finally {
      isFetchingChunk.current = false;
    }
  }, [activeChat, firstItemIndex, loading, isJumping]);

  const loadNewer = useCallback(async () => {
    if (!activeChat || loading || isJumping || isFetchingChunk.current) return;
    const currentEnd = firstItemIndex + messages.length;
    if (currentEnd >= totalMessages) return;

    isFetchingChunk.current = true;
    try {
      const res = await axios.get(`${API_URL}/api/chats/${activeChat.id}/messages`, {
        params: { limit: CHUNK_SIZE, offset: currentEnd }
      });
      
      setMessages(prev => [...prev, ...res.data]);
    } catch (err) {
      console.error("Load newer error", err);
    } finally {
      isFetchingChunk.current = false;
    }
  }, [activeChat, firstItemIndex, messages.length, totalMessages, loading, isJumping]);

  const handleScrollState = useCallback((scrolling) => {
    setIsScrolling(scrolling);
    if (scrolling) {
      if (scrollingTimeout.current) clearTimeout(scrollingTimeout.current);
      setShowFloatingDate(true);
    } else {
      scrollingTimeout.current = setTimeout(() => {
        setShowFloatingDate(false);
      }, 1500);
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

  const relativeTopIdx = topIndex - firstItemIndex;
  const topMsg = messages[relativeTopIdx];
  const floatingDateString = topMsg ? formatNiceDate(topMsg.timestamp.split(' ')[0]) : '';

  return (
    <div className="main-chat" style={{ display: isMobile ? 'flex' : 'flex' }}>

      <div className="chat-header">
        {isMobile && (
          <ArrowLeft size={24} style={{ marginRight: '15px', cursor: 'pointer', flexShrink: 0 }} onClick={() => setActiveChat(null)} />
        )}
        <img src={activeChat.img} alt={activeChat.name} className="chat-avatar" style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0, paddingRight: '10px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeChat.name}</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{totalMessages.toLocaleString()} messages</p>
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
        <button className="icon-btn-small" onClick={() => navigateSearch(-1)}>
          <ChevronUp size={18} />
        </button>
        <button className="icon-btn-small" onClick={() => navigateSearch(1)}>
          <ChevronDown size={18} />
        </button>
      </div>

      <div className="messages-container-wrapper">
        {(loading || isJumping) && (
          <div className="loader-container" style={{ position: 'absolute', zIndex: 10, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
            <div className="loader"></div>
          </div>
        )}
        
        {!loading && messages.length > 0 && (
          <Virtuoso
            ref={virtuosoRef}
            style={{ flex: 1, width: '100%' }}
            data={messages}
            firstItemIndex={firstItemIndex}
            computeItemKey={(index, item) => item.id || index}
            initialTopMostItemIndex={messages.length - 1}
            startReached={loadOlder}
            endReached={loadNewer}
            isScrolling={handleScrollState}
            atBottomThreshold={100}
            atBottomStateChange={(atBottom) => setShowScrollBottom(!atBottom)}
            rangeChanged={(range) => setTopIndex(range.startIndex)}
            itemContent={(index, msg) => {
              const arrayIndex = index - firstItemIndex;
              let showDate = false;
              let msgDate = msg.timestamp.split(' ')[0];
              
              if (arrayIndex === 0) showDate = true;
              else {
                const prevDate = messages[arrayIndex - 1]?.timestamp.split(' ')[0];
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

                      <MessageBubble msg={msg} isOut={isOut} isHighlighted={isHighlighted} searchQuery={searchQuery} R2_URL={R2_URL} />
                    </div>
                  </div>
                </div>
              );
            }}
          />
        )}
      </div>

      <div className={`date-menu ${!dateMenuOpen ? 'hidden' : ''}`}>
        {backendDates.map(item => (
          <div key={item.index} className="date-link" onClick={() => {
            jumpToIdx(item.index, 'start');
            setDateMenuOpen(false);
          }}>
            {formatNiceDate(item.label)}
          </div>
        ))}
      </div>

      <div className={`fab-bottom ${showScrollBottom ? 'visible' : ''}`} onClick={() => virtuosoRef.current?.scrollToIndex({ index: totalMessages - 1, align: 'start', behavior: 'smooth' })}>
        <ChevronDown size={24} />
      </div>
    </div>
  );
}

