import { useRef, useCallback } from 'react';

interface SoundCache {
  [key: string]: HTMLAudioElement;
}

export function useSound() {
  const soundCacheRef = useRef<SoundCache>({});

  // Preload and cache audio files
  const preloadSound = useCallback((url: string) => {
    if (!soundCacheRef.current[url]) {
      const audio = new Audio(url);
      audio.preload = 'auto';
      
      // Add error handling for missing audio files
      audio.addEventListener('error', () => {
        console.warn(`Sound file not found: ${url}. Skipping audio playback.`);
      });
      
      soundCacheRef.current[url] = audio;
    }
    return soundCacheRef.current[url];
  }, []);

  // Play sound with optimized performance
  const playSound = useCallback(async (url: string) => {
    try {
      const audio = preloadSound(url);
      
      // Reset audio to beginning if it was previously played
      audio.currentTime = 0;
      
      // Play immediately without waiting for async operations
      const playPromise = audio.play();
      
      // Handle play promise if it exists (newer browsers)
      if (playPromise !== undefined) {
        await playPromise;
      }
    } catch (error) {
      console.warn(`Could not play sound: ${url}. This is likely due to missing audio files or browser restrictions.`);
    }
  }, [preloadSound]);

  // Preload common sounds on hook initialization
  const preloadCommonSounds = useCallback(() => {
    preloadSound('/sounds/iphone_ding.mp3');
    preloadSound('/sounds/ting.mp3');
  }, [preloadSound]);

  return {
    playSound,
    preloadSound,
    preloadCommonSounds
  };
}