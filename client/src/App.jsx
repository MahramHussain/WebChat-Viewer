import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Toaster } from 'react-hot-toast';

import LockScreen from './components/LockScreen';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import UploadModal from './components/UploadModal';
import './index.css';

const API_URL = import.meta.env.VITE_API_URL || '';
const R2_URL = "https://pub-a07443f8cdb140edb1b5ed863a70c0a4.r2.dev/";

export default function App() {
  const [unlocked, setUnlocked] = useState(false);
  
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const [uploadOpen, setUploadOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (unlocked) {
      axios.get(`${API_URL}/api/chats`).then((res) => {
        setChats(res.data);
      });
    }
  }, [unlocked]);

  useEffect(() => {
    if (!activeChat) return;

    setLoading(true);
    axios.get(`${API_URL}/api/chats/${activeChat.id}/messages?limit=400000`)
      .then((res) => {
        setMessages(res.data);
      })
      .catch((err) => console.error(err))
      .finally(() => {
        setLoading(false);
      });
  }, [activeChat]);

  if (!unlocked) {
    return (
      <>
        <Toaster position="top-center" reverseOrder={false} />
        <LockScreen onUnlock={() => setUnlocked(true)} />
      </>
    );
  }

  return (
    <div className="app-container">
      <Toaster position="top-center" reverseOrder={false} />
      
      <UploadModal 
        chats={chats}
        uploadOpen={uploadOpen}
        setUploadOpen={setUploadOpen}
        activeChat={activeChat}
        setActiveChat={setActiveChat}
      />

      <Sidebar 
        isMobile={isMobile}
        activeChat={activeChat}
        setActiveChat={setActiveChat}
        chats={chats}
      />

      <ChatArea 
        isMobile={isMobile}
        activeChat={activeChat}
        setActiveChat={setActiveChat}
        messages={messages}
        loading={loading}
        setUploadOpen={setUploadOpen}
        R2_URL={R2_URL}
      />
    </div>
  );
}
