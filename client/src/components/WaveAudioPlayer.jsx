import React, { useRef, useState, useEffect, useMemo } from 'react';

export default function WaveAudioPlayer({ url, isOut, msg, R2_URL }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Exact profile picture logic synchronized from ChatArea.jsx
  const getProfilePic = (sender) => {
    if (!msg || !R2_URL) return "https://ui-avatars.com/api/?name=User&background=random";
    if (isOut) return `${R2_URL}profile_me.jpg`;
    if (sender === 'Mahram' || sender === 'م ح') return `${R2_URL}profile_mahram.jpg`;
    return `https://i.pravatar.cc/150?u=${encodeURIComponent(sender)}`;
  };
  const profilePic = getProfilePic(msg?.sender);

  const formatTime = (time) => {
    if (!time || isNaN(time)) return '0:00';
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const peaks = useMemo(() => {
    let hash = 0;
    const safeUrl = url || "default_audio";
    for (let i = 0; i < safeUrl.length; i++) {
        hash = (hash << 5) - hash + safeUrl.charCodeAt(i);
    }
    const wave = [];
    // 50 thin bars for an elegant, elongated look (less beefy)
    for (let i = 0; i < 50; i++) {
      let val = Math.abs(Math.sin(hash + i * i * 3.14)) * 0.6; // less tall
      if (typeof val !== 'number' || isNaN(val)) val = 0.4;
      val += 0.15; // Minimum small height
      wave.push(val);
    }
    return wave;
  }, [url]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const onTimeUpdate = () => {
      if (!isDragging && audio.duration && audio.duration > 0) {
        setProgress(audio.currentTime / audio.duration);
        setCurrentTime(audio.currentTime);
      }
    };
    
    const onEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
      if (audio) audio.currentTime = 0;
    };

    const onLoadedMetadata = () => {
      if (audio.duration && audio.duration !== Infinity) {
        setDuration(audio.duration);
      }
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    
    if (audio.readyState >= 1) onLoadedMetadata();
    
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
    };
  }, [isDragging]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(e => console.warn('Audio playback failed:', e));
    }
  };

  const handleSeek = (e) => {
    const newProgress = parseFloat(e.target.value);
    setProgress(newProgress);
    if (duration > 0) {
      setCurrentTime(newProgress * duration);
    }
  };

  const handleDragEnd = (e) => {
    setIsDragging(false);
    const audio = audioRef.current;
    if (audio && audio.duration) {
      const newProgress = parseFloat(e.target.value);
      audio.currentTime = newProgress * audio.duration;
      setProgress(newProgress);
      setCurrentTime(audio.currentTime);
    }
  };

  const playedColor = isOut ? '#ffffff' : '#53bdeb';
  const unplayedColor = isOut ? 'rgba(255, 255, 255, 0.4)' : '#6b7a82';
  const thumbColor = '#00e676';
  
  // Cutout bg based on typical dark mode bubble colors to blend the badge
  const badgeBgColor = isOut ? '#005c4b' : '#202c33';

  const rangeThumbStyle = {
    WebkitAppearance: 'none',
    appearance: 'none',
    width: '100%',
    height: '100%',
    background: 'transparent',
    opacity: 0, // completely hides native browser/OS thumb
    outline: 'none',
    position: 'absolute',
    top: 0,
    left: 0,
    margin: 0,
    zIndex: 2,
    cursor: 'pointer'
  };

  const playBtn = (
    <button 
      onClick={togglePlay} 
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0', color: '#a6b0b6', flexShrink: 0, outline: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px' }}
    >
      {isPlaying ? (
         <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
         </svg>
      ) : (
         <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
         </svg>
      )}
    </button>
  );

  const waveform = (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '2px', height: '24px', width: '155px', marginTop: '-4px' }}>
      
      {peaks.map((heightFactor, i) => {
        const barProgress = i / peaks.length;
        const isPlayed = barProgress <= progress;
        return (
          <div 
            key={i} 
            style={{
              width: '2px', // Thin and elegant
              backgroundColor: isPlayed ? playedColor : unplayedColor,
              height: `${heightFactor * 100}%`,
              borderRadius: '2px',
              transition: isDragging ? 'none' : 'background-color 0.1s linear'
            }}
          />
        );
      })}
      
      {peaks.length > 0 && (
        <div style={{
          position: 'absolute',
          left: `${progress * 100}%`,
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          backgroundColor: thumbColor,
          pointerEvents: 'none',
          zIndex: 1,
          transition: isDragging ? 'none' : 'left 0.1s linear'
        }} />
      )}

      <input 
        type="range"
        min="0"
        max="1"
        step="0.001"
        value={progress}
        onChange={handleSeek}
        onMouseDown={() => setIsDragging(true)}
        onTouchStart={() => setIsDragging(true)}
        onMouseUp={handleDragEnd}
        onTouchEnd={handleDragEnd}
        style={rangeThumbStyle}
      />
      
      {/* Time Text positioned absolutely to not break horizontal alignment of the parent flex row */}
      <div style={{ position: 'absolute', bottom: '-16px', left: '0px', fontSize: '11px', color: '#8696a0', fontFamily: 'inherit', fontWeight: 500, letterSpacing: '0.2px' }}>
        {isPlaying || progress > 0 ? formatTime(currentTime) : formatTime(duration)}
      </div>
    </div>
  );

  const avatar = (
    <div style={{ position: 'relative', flexShrink: 0, marginLeft: !isOut ? '8px' : '0px', marginRight: isOut ? '8px' : '0px' }}>
      <img 
        src={profilePic} 
        alt="Avatar" 
        style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover' }}
        onError={(e) => { e.target.src = "https://ui-avatars.com/api/?name=User&background=random"; }}
      />
      <div style={{
        position: 'absolute',
        bottom: '-2px',
        left: '-4px',
        backgroundColor: badgeBgColor,
        borderRadius: '50%',
        width: '18px',
        height: '18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <svg viewBox="0 0 24 24" width="12" height="12" fill="#00e676">
          <path d="M11.999 14.942c2.005 0 3.531-1.53 3.531-3.531V4.35c0-2.001-1.526-3.531-3.531-3.531S8.468 2.349 8.468 4.35v7.061c0 2.001 1.526 3.531 3.531 3.531zm6.238-3.53c0 3.531-2.942 6.002-6.237 6.002s-6.237-2.471-6.237-6.002H3.761c0 4.001 3.178 7.297 7.061 7.885v3.884h2.354v-3.884c3.884-.588 7.061-3.884 7.061-7.885h-1.999z"/>
        </svg>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', minHeight: '52px', gap: '8px', width: 'fit-content', padding: '6px 4px', boxSizing: 'border-box' }}>
      {isOut && avatar}
      {playBtn}
      {waveform}
      {!isOut && avatar}
      
      <audio ref={audioRef} src={url} preload="metadata" style={{ display: 'none' }} />
    </div>
  );
}

