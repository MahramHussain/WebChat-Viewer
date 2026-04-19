import React, { useState } from 'react';
import axios from 'axios';
import { UploadCloud, X } from 'lucide-react';
import { toast } from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function UploadModal({ chats, uploadOpen, setUploadOpen, activeChat, setActiveChat }) {
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadChatId, setUploadChatId] = useState('chat1');
  const [uploadVideoFolder, setUploadVideoFolder] = useState('');

  if (!uploadOpen) return null;

  const handleFileUpload = async (e) => {
    const file = e.target.files ? e.target.files[0] : null;
    if (!file || !uploadChatId) return;

    setUploadLoading(true);
    const toastId = toast.loading('Processing & Cleaning megabytes of Data...');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await axios.post(`${API_URL}/api/upload-chat?chatId=${uploadChatId}&videoFolder=${uploadVideoFolder}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        }
      });
      
      toast.success(res.data.message, { id: toastId });
      setUploadOpen(false);
      
      if (activeChat?.id === uploadChatId) {
        setActiveChat({ ...activeChat });
      }
    } catch (err) {
      toast.error("Upload failed: " + (err.response?.data?.error || err.message), { id: toastId });
    } finally {
      setUploadLoading(false);
    }
  };

  return (
    <div className="upload-overlay">
      <div className="upload-modal">
        <h2>
          Inject Chat Export
          <X size={24} onClick={() => setUploadOpen(false)} style={{ cursor: 'pointer' }} />
        </h2>

        <p style={{ fontSize: '14px', color: '#8696a0', marginTop: '-10px' }}>
          Select a target chat, specify standard video folder mapping (optional), and drop your `.txt` export.
        </p>

        <select value={uploadChatId} onChange={(e) => setUploadChatId(e.target.value)}>
          {chats.map(c => <option key={c.id} value={c.id}>{c.name} ({c.id})</option>)}
        </select>

        <input
          type="text"
          placeholder="Video notes folder (e.g. video_notes_1)"
          value={uploadVideoFolder}
          onChange={(e) => setUploadVideoFolder(e.target.value)}
        />

        <label className="upload-draggable">
          <input type="file" accept=".txt" className="upload-hidden-input" onChange={handleFileUpload} />
          <UploadCloud size={48} color="#00a884" />
          {uploadLoading ? (
            <p>Streaming data...</p>
          ) : (
            <p>Click to select or Drop .txt file here</p>
          )}
        </label>
      </div>
    </div>
  );
}
