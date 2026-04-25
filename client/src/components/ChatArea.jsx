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
  const searchInputRef = useRef(null); // Added Ref to auto-focus the search bar

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
  const [virtuosoKey, setVirtuosoKey] = useState(0);
  const [initialTopMost, setInitialTopMost] = useState(0);
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
          setInitialTopMost(total - 1);
          setVirtuosoKey(prev => prev + 1);
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

  // Ctrl+F / Cmd+F Override to open custom search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault(); // Blocks the browser's native find box
        setSearchOpen(true);
        // Slight delay ensures the input renders before focusing it
        setTimeout(() => searchInputRef.current?.focus(), 50); 
      }
      
      // Bonus: Pressing Escape closes the custom search bar
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchOpen]);

  const navigateSearch = (direction) => {
    if (searchMatches.length === 0 || loading || isFetchingChunk.current) return;
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
      virtuosoRef.current?.scrollToIndex({ index: targetIdx, align, behavior: 'auto' });
    } else {
      setLoading(true);
      try {
        const offset = align === 'start' ? targetIdx : Math.max(0, targetIdx - Math.floor(CHUNK_SIZE / 2));
        const res = await axios.get(`${API_URL}/api/chats/${activeChat.id}/messages`, {
          params: { limit: CHUNK_SIZE, offset }
        });
        
        setFirstItemIndex(offset);
        setMessages(res.data);
        
        const localIdx = targetIdx - offset;
        const topMost = align === 'start' ? localIdx : Math.max(0, localIdx - 2);
        setInitialTopMost(topMost);
        
        setVirtuosoKey(prev => prev + 1);
      } catch (err) {
        console.error("Jump error", err);
      } finally {
        setLoading(false);
      }
    }
  };

  // Jump to the very bottom (latest messages)
  const scrollToBottom = async () => {
    if (!activeChat) return;
    const targetIdx = totalMessages - 1;
    const isLoaded = targetIdx >= firstItemIndex && targetIdx < firstItemIndex + messages.length;

    if (isLoaded) {
      virtuosoRef.current?.scrollToIndex({ index: targetIdx, align: 'end', behavior: 'smooth' });
    } else {
      setLoading(true);
      try {
        const offset = Math.max(0, totalMessages - CHUNK_SIZE);
        const res = await axios.get(`${API_URL}/api/chats/${activeChat.id}/messages`, {
          params: { limit: CHUNK_SIZE, offset }
        });
        
        setFirstItemIndex(offset);
        setMessages(res.data);
        setInitialTopMost(CHUNK_SIZE - 1);
        setVirtuosoKey(prev => prev + 1);
      } catch (err) {
        console.error("Jump to bottom error", err);
      } finally {
        setLoading(false);
      }
    }
  };

  // Jump to the absolute top (first messages)
  const scrollToTop = async () => {
    if (!activeChat) return;
    const targetIdx = 0;
    const isLoaded = targetIdx >= firstItemIndex && targetIdx < firstItemIndex + messages.length;

    if (isLoaded) {
      virtuosoRef.current?.scrollToIndex({ index: targetIdx, align: 'start', behavior: 'smooth' });
    } else {
      setLoading(true);
      try {
        const res = await axios.get(`${API_URL}/api/chats/${activeChat.id}/messages`, {
          params: { limit: CHUNK_SIZE, offset: 0 }
        });
        
        setFirstItemIndex(0);
        setMessages(res.data);
        setInitialTopMost(0);
        setVirtuosoKey(prev => prev + 1);
      } catch (err) {
        console.error("Jump to top error", err);
      } finally {
        setLoading(false);
      }
    }
  };

  // Infinite Scroll Callbacks
  const loadOlder = useCallback(async () => {
    if (!activeChat || firstItemIndex <= 0 || loading || isFetchingChunk.current) return;
    
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
  }, [activeChat, firstItemIndex, loading]);

  const loadNewer = useCallback(async () => {
    if (!activeChat || loading || isFetchingChunk.current) return;
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
  }, [activeChat, firstItemIndex, messages.length, totalMessages, loading]);

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
          <div className="fab-top" onClick={() => {
            setSearchOpen(!searchOpen);
            // Auto-focus when clicking the magnifying glass icon too
            if (!searchOpen) setTimeout(() => searchInputRef.current?.focus(), 50);
          }}>
            <Search size={isMobile ? 18 : 20} />
          </div>
          <div className="fab-top" onClick={scrollToTop}>
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
          ref={searchInputRef} // Tied the ref directly to this input
          type="text"
          placeholder="Find in chat..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          autoFocus={searchOpen}
        />
        <span className="search-count">
          {searchMatches.length > 0 ? `${currentMatchIdx + 1}/${searchMatches.length}` : '0/0'}
        </span>
        <button 
          className="icon-btn-small" 
          onMouseDown={(e) => e.preventDefault()} 
          onClick={() => navigateSearch(-1)}
          disabled={loading || isFetchingChunk.current}
          style={{ opacity: (loading || isFetchingChunk.current) ? 0.5 : 1 }}
        >
          <ChevronUp size={18} />
        </button>
        <button 
          className="icon-btn-small" 
          onMouseDown={(e) => e.preventDefault()} 
          onClick={() => navigateSearch(1)}
          disabled={loading || isFetchingChunk.current}
          style={{ opacity: (loading || isFetchingChunk.current) ? 0.5 : 1 }}
        >
          <ChevronDown size={18} />
        </button>
      </div>

      <div className="messages-container-wrapper">
        {loading && (
          <div className="loader-container" style={{ position: 'absolute', zIndex: 10, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
            <div className="loader"></div>
          </div>
        )}
        
        {!loading && messages.length > 0 && (
          <Virtuoso
            key={virtuosoKey}
            ref={virtuosoRef}
            style={{ flex: 1, width: '100%' }}
            data={messages}
            firstItemIndex={firstItemIndex}
            computeItemKey={(index, item) => item.id || index}
            initialTopMostItemIndex={initialTopMost}
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
                      <span 
                        key={getUsernameTag(isOut, msg.sender)} 
                        className="username-tag" 
                        style={{ color: isOut ? 'var(--accent-green)' : '#d864d8' }}
                      >
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

      {/* Aesthetic UI Input Bar (Non-functional) */}
      <div className="dummy-chat-bar">
        <input 
          type="text" 
          className="dummy-input" 
          placeholder="Message Mahram..." 
          readOnly 
        />
        <button className="dummy-send-btn">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path>
          </svg>
        </button>
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

      <div className={`fab-bottom ${showScrollBottom ? 'visible' : ''}`} onClick={scrollToBottom}>
        <ChevronDown size={24} />
      </div>
    </div>
  );
}