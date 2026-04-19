import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Play, Pause } from 'lucide-react';

export default function WaveAudioPlayer({ url, isOut }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const formatTime = (time) => {
    if (!time || isNaN(time)) return '0:00';
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Generate a completely deterministic "fake" waveform based on the file URL string layout
  // This guarantees identical audio notes always show the identical unique wave pattern
  const peaks = useMemo(() => {
    let hash = 0;
    const safeUrl = url || "default_audio";
    for (let i = 0; i < safeUrl.length; i++) {
        hash = (hash << 5) - hash + safeUrl.charCodeAt(i);
    }
    const wave = [];
    for (let i = 0; i < 35; i++) {
      // Create a smooth but random-looking soundwave footprint
      let val = Math.abs(Math.sin(hash + i * i * 3.14)) * 0.8;
      if (typeof val !== 'number' || isNaN(val)) val = 0.5;
      val += 0.2; // Minimum height of 20%
      wave.push(val);
    }
    return wave;
  }, [url]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const onTimeUpdate = () => {
      if (audio.duration && audio.duration > 0) {
        setProgress(audio.currentTime / audio.duration);
        setCurrentTime(audio.currentTime);
      }
    };
    
    const onEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    };

    const onLoadedMetadata = () => {
      if (audio.duration && audio.duration !== Infinity) {
        setDuration(audio.duration);
      }
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    
    // Fallback if metadata is already loaded
    if (audio.readyState >= 1) onLoadedMetadata();
    
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
    };
  }, []);

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

  const playedColor = isOut ? '#ffffff' : '#00a884';
  const unplayedColor = isOut ? 'rgba(255, 255, 255, 0.4)' : '#a1afb6';

  return (
    <div style={{ display: 'flex', alignItems: 'center', height: '54px', gap: '10px', width: '240px', maxWidth: '100%', padding: '4px 6px', boxSizing: 'border-box', overflow: 'hidden' }}>
      <button 
        onClick={togglePlay} 
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: isOut ? 'white' : '#8696a0', flexShrink: 0, outline: 'none' }}
      >
        {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" />}
      </button>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', height: '24px' }}>
          {peaks.map((heightFactor, i) => {
            const isPlayed = (i / peaks.length) <= progress;
            return (
              <div 
                key={i} 
                style={{
                  flex: 1,
                  backgroundColor: isPlayed ? playedColor : unplayedColor,
                  height: `${heightFactor * 100}%`,
                  borderRadius: '2px',
                  transition: 'background-color 0.1s linear'
                }}
              />
            );
          })}
        </div>
        <div style={{ fontSize: '11px', color: isOut ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.5)', fontFamily: 'system-ui' }}>
          {isPlaying || progress > 0 ? formatTime(currentTime) : formatTime(duration)}
        </div>
      </div>
      
      <audio ref={audioRef} src={url} preload="metadata" style={{ display: 'none' }} />
    </div>
  );
}
