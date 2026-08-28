import React, { useEffect, useRef, useState } from 'react';

interface OpeningScreenProps {
  onFinish: () => void;
}

const OpeningScreen: React.FC<OpeningScreenProps> = ({ onFinish }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<'waiting_tap' | 'playing_video'>('waiting_tap');
  const [bgImage, setBgImage] = useState<string>('');

  useEffect(() => {
    // Try using OPENING.PNG from the public directory
    setBgImage(`${import.meta.env.BASE_URL}OPENING.PNG`);
  }, []);

  const handleStartPlay = () => {
    setPhase('playing_video');
  };

  useEffect(() => {
    if (phase === 'playing_video' && videoRef.current) {
      videoRef.current.defaultMuted = false;
      videoRef.current.muted = false; // BGM / Audio ON!
      videoRef.current.play()
        .catch(err => {
          console.error("Video play failed:", err);
          onFinish();
        });
    }
  }, [phase, onFinish]);

  // Safety timer: proceed after 60 seconds if video gets stuck
  useEffect(() => {
    const timer = setTimeout(() => {
      onFinish();
    }, 60000);
    return () => clearTimeout(timer);
  }, [onFinish]);

  if (phase === 'waiting_tap') {
    return (
      <div 
        onClick={handleStartPlay}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: '#000000',
          backgroundImage: bgImage ? `url(${bgImage})` : 'none',
          backgroundSize: 'contain',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 9999
        }}
      >
        {/* Blinking Tap card */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.75)',
          padding: '1.25rem 2.5rem',
          borderRadius: '24px',
          border: '2px solid rgba(255, 255, 255, 0.15)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          textAlign: 'center',
          pointerEvents: 'none',
          animation: 'pulse 1.5s infinite ease-in-out',
        }}>
          <div style={{ fontSize: '1.8rem', color: '#fff', fontWeight: 900, letterSpacing: '0.1em' }}>
            タップしてね
          </div>
          <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', marginTop: '0.4rem' }}>
            CLICK OR TAP TO START
          </div>
        </div>

        <style dangerouslySetInnerHTML={{__html: `
          @keyframes pulse {
            0% { transform: scale(0.98); opacity: 0.8; }
            50% { transform: scale(1.02); opacity: 1; border-color: rgba(99, 102, 241, 0.6); box-shadow: 0 0 20px rgba(99, 102, 241, 0.4); }
            100% { transform: scale(0.98); opacity: 0.8; }
          }
        `}} />
      </div>
    );
  }

  return (
    <div 
      onClick={onFinish}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: '#000000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        overflow: 'hidden',
        zIndex: 9999
      }}
    >
      <video
        ref={videoRef}
        src={`${import.meta.env.BASE_URL}opening.mp4?t=${Date.now()}`}
        playsInline
        loop={false}
        controls={false}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain'
        }}
        onEnded={onFinish}
        onError={onFinish}
      />
      <div style={{
        position: 'absolute',
        bottom: '2rem',
        right: '2rem',
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: '0.9rem',
        background: 'rgba(0, 0, 0, 0.5)',
        padding: '0.5rem 1rem',
        borderRadius: '20px',
        pointerEvents: 'none',
        fontFamily: 'sans-serif'
      }}>
        画面タップでスキップ
      </div>
    </div>
  );
};

export default OpeningScreen;
