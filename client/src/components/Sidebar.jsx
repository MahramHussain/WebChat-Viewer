import React from 'react';

export default function Sidebar({ isMobile, activeChat, setActiveChat, chats }) {
  return (
    <div className="sidebar" style={{ display: isMobile && activeChat ? 'none' : 'flex' }}>
      <div className="sidebar-header">
        <h2>Chats</h2>
      </div>
      <div className="search-bar-container">
        <input type="text" placeholder="Search or start new chat" className="sidebar-search" />
      </div>
      <div className="chat-list">
        {chats.map(chat => (
          <div
            key={chat.id}
            className={`chat-item ${activeChat?.id === chat.id ? 'active' : ''}`}
            onClick={() => setActiveChat(chat)}
          >
            <img src={chat.img} alt={chat.name} className="chat-avatar" />
            <div className="chat-info">
              <h3>{chat.name}</h3>
              <p>Tap to view history</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
