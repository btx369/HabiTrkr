import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

interface AudioPlayerProps {
  audioUrl: string;
  initialDuration?: number;
  /**
   * Smaller controls, for cards in the grid views. Affects sizing only — the layout is
   * always play · seeker · time · speed, so the player looks the same everywhere.
   */
  compact?: boolean;
  /** Show seek slider */
  showSeeker?: boolean;
  /** Show playback speed control */
  showSpeedControl?: boolean;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Callback when audio ends */
  onEnded?: () => void;
  /** Called when this player starts playing, so callers can pause other tracks */
  onPlay?: () => void;
}

/**
 * Reusable audio player component with play/pause, seek, and speed controls.
 * Encapsulates all audio state management and cleanup.
 */
export function AudioPlayer({
  audioUrl,
  initialDuration = 0,
  compact = false,
  showSeeker = true,
  showSpeedControl = false,
  size = 'md',
  onEnded,
  onPlay,
}: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(initialDuration);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // `onPlay` is called from togglePlayback, which is recreated each render, so reading
  // it directly is fine; kept in a ref anyway so a caller passing an inline function
  // cannot change behaviour between renders.
  const onPlayRef = useRef(onPlay);
  onPlayRef.current = onPlay;

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const initAudio = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl);

      audioRef.current.addEventListener('loadedmetadata', () => {
        const d = audioRef.current?.duration || 0;
        if (d > 0) setDuration(d);
      });

      audioRef.current.addEventListener('timeupdate', () => {
        setCurrentTime(audioRef.current?.currentTime || 0);
      });

      audioRef.current.addEventListener('ended', () => {
        setIsPlaying(false);
        setCurrentTime(0);
        onEnded?.();
      });

      audioRef.current.addEventListener('error', () => {
        setIsPlaying(false);
      });
    }
    return audioRef.current;
  }, [audioUrl, onEnded]);

  const togglePlayback = (e: React.MouseEvent) => {
    e.stopPropagation();
    const audio = initAudio();

    audio.playbackRate = playbackSpeed;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play()
        .then(() => {
          setIsPlaying(true);
          onPlayRef.current?.();
        })
        .catch(() => setIsPlaying(false));
    }
  };

  const handleSeek = (value: number[]) => {
    const newTime = value[0];
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const cyclePlaybackSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    const speeds = [1, 1.5, 2];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
    setPlaybackSpeed(nextSpeed);

    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const buttonSize = size === 'sm' || compact ? 'h-6 w-6' : 'h-8 w-8';
  const iconSize = size === 'sm' || compact ? 10 : 12;
  const speedButtonClass = compact
    ? 'h-6 px-1.5 text-[10px]'
    : 'h-8 px-2 text-xs';

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        onClick={togglePlayback}
        className={`${buttonSize} rounded-full p-0 flex-shrink-0`}
      >
        {isPlaying ? <Pause size={iconSize} /> : <Play size={iconSize} />}
      </Button>

      {showSeeker && (
        <div
          className="flex-1 mx-2 min-w-0"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <Slider
            value={[currentTime]}
            onValueChange={handleSeek}
            max={Math.max(duration, 1)}
            step={0.1}
            className="w-full"
          />
        </div>
      )}

      <span className={`${compact ? 'text-[10px]' : 'text-xs'} text-muted-foreground flex-shrink-0`}>
        {formatDuration(Math.floor(currentTime))}/{formatDuration(Math.floor(duration))}
      </span>

      {showSpeedControl && (
        <Button
          size="sm"
          variant="outline"
          onClick={cyclePlaybackSpeed}
          className={`${speedButtonClass} flex-shrink-0`}
        >
          {playbackSpeed}×
        </Button>
      )}
    </div>
  );
}

interface MultiAudioPlayerProps {
  audios: { url: string; duration: number }[];
  /** Size variant */
  size?: 'sm' | 'md';
}

/**
 * Manages multiple audio players, ensuring only one plays at a time.
 * Includes a shared playback speed control.
 */
export function MultiAudioPlayer({ audios, size = 'md' }: MultiAudioPlayerProps) {
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const [audioTimes, setAudioTimes] = useState<Map<string, number>>(new Map());
  const [audioDurations, setAudioDurations] = useState<Map<string, number>>(new Map());

  // Cleanup all audios on unmount
  useEffect(() => {
    // Capture the map itself in the effect body. Reading `audioRefs.current` inside the
    // cleanup would re-read the ref at teardown time, which is exactly when it is least
    // reliable; holding the reference makes the cleanup act on the map it started with.
    const audios = audioRefs.current;
    return () => {
      audios.forEach(audio => audio.pause());
      audios.clear();
    };
  }, []);

  const toggleAudio = (url: string, initialDuration: number, e: React.MouseEvent) => {
    e.stopPropagation();

    let audio = audioRefs.current.get(url);
    const isCurrentlyPlaying = playingUrl === url;

    if (!audio) {
      audio = new Audio(url);
      audioRefs.current.set(url, audio);

      audio.addEventListener('loadedmetadata', () => {
        const d = audio!.duration;
        setAudioDurations(prev => new Map(prev).set(url, d));
      });

      audio.addEventListener('timeupdate', () => {
        setAudioTimes(prev => new Map(prev).set(url, audio!.currentTime));
      });

      audio.addEventListener('ended', () => {
        setPlayingUrl(null);
        setAudioTimes(prev => new Map(prev).set(url, 0));
      });

      setAudioDurations(prev => new Map(prev).set(url, initialDuration));
    }

    if (isCurrentlyPlaying) {
      audio.pause();
      setPlayingUrl(null);
    } else {
      // Pause any currently playing audio
      if (playingUrl) {
        const currentAudio = audioRefs.current.get(playingUrl);
        if (currentAudio) {
          currentAudio.pause();
        }
      }

      audio.playbackRate = playbackSpeed;
      audio.play()
        .then(() => setPlayingUrl(url))
        .catch(() => setPlayingUrl(null));
    }
  };

  const handleSeek = (url: string, value: number[]) => {
    const newTime = value[0];
    const audio = audioRefs.current.get(url);
    if (audio) {
      audio.currentTime = newTime;
      setAudioTimes(prev => new Map(prev).set(url, newTime));
    }
  };

  const cyclePlaybackSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    const speeds = [1, 1.5, 2];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
    setPlaybackSpeed(nextSpeed);

    audioRefs.current.forEach(audio => {
      audio.playbackRate = nextSpeed;
    });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const buttonSize = size === 'sm' ? 'h-6 w-6' : 'h-8 w-8';
  const iconSize = size === 'sm' ? 10 : 12;
  const speedButtonClass = size === 'sm' ? 'h-6 px-1.5 text-[10px]' : 'h-8 px-2 text-xs';

  return (
    <div className="flex flex-col gap-2">
      {audios.slice(0, 3).map((audio) => {
        const isPlaying = playingUrl === audio.url;
        const currentTime = audioTimes.get(audio.url) || 0;
        const duration = audioDurations.get(audio.url) || audio.duration || 0;

        return (
          <div key={audio.url} className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={(e) => toggleAudio(audio.url, audio.duration, e)}
              className={`${buttonSize} rounded-full p-0 flex-shrink-0`}
            >
              {isPlaying ? <Pause size={iconSize} /> : <Play size={iconSize} />}
            </Button>

            <div
              className="flex-1 mx-2 min-w-0"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              <Slider
                value={[currentTime]}
                onValueChange={(value) => handleSeek(audio.url, value)}
                max={Math.max(duration, 1)}
                step={0.1}
                className="w-full"
              />
            </div>

            <span className={`${size === 'sm' ? 'text-[10px]' : 'text-xs'} text-muted-foreground flex-shrink-0`}>
              {formatDuration(Math.floor(currentTime))}/{formatDuration(Math.floor(duration))}
            </span>

            {/* Speed control sits in the same row as the seeker, matching AudioPlayer.
                It used to render on its own row underneath, which read as unrelated to
                the track it applies to. */}
            <Button
              size="sm"
              variant="outline"
              onClick={cyclePlaybackSpeed}
              className={`${speedButtonClass} flex-shrink-0`}
            >
              {playbackSpeed}×
            </Button>
          </div>
        );
      })}
    </div>
  );
}
