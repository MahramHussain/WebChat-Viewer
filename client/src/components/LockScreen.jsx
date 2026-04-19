import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function LockScreen({ onUnlock }) {
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);
  const [attempts, setAttempts] = useState(0);

  const errorMessages = [
    "Wrong code",
    "You know the password",
    "C'mon stop messing",
    "If you really dk bud you're not supposed to see this",
    "Fuck You"
  ];

  const triggerExplosion = (text, amount = 20) => {
    for (let i = 0; i < amount; i++) {
      const el = document.createElement("div");
      el.className = "explosion-text";
      el.innerText = text;
      const angle = Math.random() * Math.PI * 2;
      const velocity = 150 + Math.random() * 250;
      const rotation = (Math.random() - 0.5) * 60;
      el.style.setProperty("--tx", Math.cos(angle) * velocity + "px");
      el.style.setProperty("--ty", Math.sin(angle) * velocity + "px");
      el.style.setProperty("--rot", rotation + "deg");
      document.getElementById("lock-screen")?.appendChild(el);
      setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el) }, 2000);
    }
  };

  const handleUnlock = async () => {
    try {
      const res = await axios.post(`${API_URL}/api/verify-pin`, { pin });
      if (res.data.success) {
        onUnlock();
      }
    } catch (err) {
      handleError();
    }
  };

  const handleError = () => {
    let nextAttempt = attempts;
    if (nextAttempt < 4) {
      toast.error(errorMessages[nextAttempt]);
      triggerExplosion(errorMessages[nextAttempt], 8);
    } else {
      toast.error(errorMessages[4]);
      triggerExplosion("FUCK YOU", 30);
    }
    setAttempts(prev => prev + 1);

    setShake(true);
    setTimeout(() => setShake(false), 500);
    setPin('');
  };

  return (
    <div id="lock-screen" className="lock-screen-container">
      <div className={`lock-card ${shake ? 'shake' : ''}`}>
        <h2>Enter Security Code</h2>
        <p>The Day It All Began</p>
        <input
          type="password"
          maxLength="4"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
          onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
          placeholder="••••"
          className="pin-input"
        />
        <button onClick={handleUnlock} className="unlock-btn">Unlock</button>
      </div>
    </div>
  );
}
