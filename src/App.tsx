import React, { useEffect, useRef } from 'react';
import { LyricPlayer } from '@applemusic-like-lyrics/react';
import type { LyricLine } from '@applemusic-like-lyrics/core';

interface AppProps {
  lyrics: LyricLine[];
  currentTime: number;
  enableBlur?: boolean;
  enableScale?: boolean;
  enableSpring?: boolean;
  hidePassedLines?: boolean;
}

export const App: React.FC<AppProps> = ({ 
  lyrics, 
  currentTime,
  enableBlur = true,
  enableScale = true,
  enableSpring = true,
  hidePassedLines = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.width = "100%";
      containerRef.current.style.height = "100%";
      containerRef.current.style.zIndex = "100";
      containerRef.current.style.position = "absolute";
      containerRef.current.style.top = "0";
      containerRef.current.style.left = "0";
      containerRef.current.style.right = "0";
      containerRef.current.style.bottom = "0";
      containerRef.current.style.pointerEvents = "auto";
      containerRef.current.style.overflow = "visible";
      console.log('歌词容器样式已应用:', {
        width: containerRef.current.style.width,
        height: containerRef.current.style.height,
        zIndex: containerRef.current.style.zIndex,
        position: containerRef.current.style.position,
        display: containerRef.current.style.display
      });
    }
  }, []);

  // 转换currentTime从秒到毫秒
  const currentTimeMs = Math.floor(currentTime * 1000);

  console.log('渲染歌词:', { lyricCount: lyrics.length, currentTime, enableSpring, enableBlur, enableScale });

  return (
    <div ref={containerRef}>
      <LyricPlayer
        lyricLines={lyrics}
        currentTime={currentTimeMs}
        enableBlur={enableBlur}
        enableScale={enableScale}
        enableSpring={enableSpring}
        hidePassedLines={hidePassedLines}
        style={{
          width: '100%',
          height: '100%',
          position: 'relative'
        }}
      />
    </div>
  );
};

