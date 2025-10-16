import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const TASK_COMPLETE_SOUND_URL = '/sounds/iphone_ding.mp3';
export const TIMER_COMPLETE_SOUND_URL = '/sounds/ting.mp3';

export async function playSound(url: string) {
  try {
    const audio = new Audio(url);
    
    // Add error handling for missing audio files
    audio.addEventListener('error', (e) => {
      console.warn(`Sound file not found: ${url}. Skipping audio playback.`);
    });
    
    await audio.play();
  } catch (error) {
    console.warn(`Could not play sound: ${url}. This is likely due to missing audio files.`);
  }
}
