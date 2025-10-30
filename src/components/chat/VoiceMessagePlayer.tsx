import { useState, useRef, useEffect } from 'react';
import { Attachment } from '@/types';
import { Button } from '@/components/ui/button';
import { Play, Pause, Mic } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface VoiceMessagePlayerProps {
  attachment: Attachment;
  isMyMessage: boolean;
  senderAvatar?: string;
  senderName?: string;
}

const formatTime = (time: number) => {
  if (isNaN(time) || time === Infinity) return '0:00';
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export function VoiceMessagePlayer({ attachment, isMyMessage, senderAvatar, senderName }: VoiceMessagePlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(attachment.duration || 0);
  const [currentTime, setCurrentTime] = useState(0);

  const getInitials = (name?: string) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : '';

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      if (audio.duration && audio.duration !== Infinity) {
        setCurrentTime(audio.currentTime);
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    const handleLoadedMetadata = () => {
      if (audio.duration !== Infinity) {
        setDuration(audio.duration);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      setProgress(0);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    if (attachment.duration) {
      setDuration(attachment.duration);
    }

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [attachment.duration]);

  const togglePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(err => console.error("Audio play failed:", err));
    }
    setIsPlaying(!isPlaying);
  };

  const handleSliderChange = (value: number[]) => {
    const audio = audioRef.current;
    if (audio && duration) {
      const newTime = (value[0] / 100) * duration;
      audio.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  return (
    <div className="flex items-center gap-2 w-64">
      <audio ref={audioRef} src={attachment.url} preload="metadata" />
      
      {!isMyMessage && (
        <Avatar className="h-10 w-10 flex-shrink-0">
          <AvatarImage src={senderAvatar} />
          <AvatarFallback>{getInitials(senderName)}</AvatarFallback>
        </Avatar>
      )}

      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-10 w-10 rounded-full flex-shrink-0",
          isMyMessage ? "bg-white/20 hover:bg-white/30 text-black" : "bg-black/10 hover:bg-black/20 text-black"
        )}
        onClick={togglePlayPause}
      >
        {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-1" />}
      </Button>
      
      <div className="flex-1 flex flex-col justify-center gap-1">
        <Slider
          value={[progress]}
          onValueChange={handleSliderChange}
          max={100}
          step={1}
          className="w-full"
        />
        <div className="flex justify-between items-center">
          <span className="text-xs font-mono opacity-70">{formatTime(duration)}</span>
          <Mic className="h-3 w-3 opacity-70" />
        </div>
      </div>
    </div>
  );
}