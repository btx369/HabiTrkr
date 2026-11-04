import { useState, useRef, useEffect } from 'react';
import { Mic, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FLOATING_ADD_POPUP_RIGHT } from '@/lib/floatingAdd';
import { useLanguage } from '@/contexts/LanguageContext';

interface AudioRecorderPopupProps {
  isOpen: boolean;
  onRecordingComplete: (audioUrl: string, duration: number) => void;
  onClose: () => void;
}

export function AudioRecorderPopup({ isOpen, onRecordingComplete, onClose }: AudioRecorderPopupProps) {
  const { t } = useLanguage();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef(0);
  // True from the click until recording has really started. getUserMedia is async (the
  // permission prompt can take seconds), so a second tap used to start a second recorder and
  // a second timer; the first timer was orphaned and kept counting, in steps of 2 seconds.
  const startingRef = useRef(false);
  // The parent callbacks are replaced on every render; the recorder's onstop must call the
  // latest ones, not the ones from the render in which recording started.
  const onCompleteRef = useRef(onRecordingComplete);
  const onCloseRef = useRef(onClose);
  onCompleteRef.current = onRecordingComplete;
  onCloseRef.current = onClose;

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const releaseStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  // Closed from outside (back button, unmount): stop everything and drop the take.
  useEffect(() => {
    if (isOpen) return;
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null;
      recorder.stop();
    }
    mediaRecorderRef.current = null;
    clearTimer();
    releaseStream();
    startingRef.current = false;
    setIsRecording(false);
    setRecordingTime(0);
  }, [isOpen]);

  useEffect(() => () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null;
      recorder.stop();
    }
    clearTimer();
    releaseStream();
  }, []);

  if (!isOpen) return null;

  const startRecording = async () => {
    if (startingRef.current || mediaRecorderRef.current) return;
    startingRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      // Speech at 32 kbps is about 240 KB a minute, which matters because recordings are
      // stored in localStorage alongside everything else.
      const mediaRecorder = new MediaRecorder(stream, { audioBitsPerSecond: 32000 });
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        releaseStream();
        const seconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
        // Label the data with the format the browser actually recorded (WebM on Chrome,
        // MP4 on Safari). Calling it WAV made Safari refuse to play it back.
        const mimeType = (mediaRecorder.mimeType || chunks[0]?.type || 'audio/webm').split(';')[0];
        const blob = new Blob(chunks, { type: mimeType });

        // Convert to base64 for persistence
        const reader = new FileReader();
        reader.onloadend = () => {
          mediaRecorderRef.current = null;
          startingRef.current = false;
          setRecordingTime(0);
          onCompleteRef.current(reader.result as string, seconds);
          onCloseRef.current();
        };
        reader.readAsDataURL(blob);
      };

      mediaRecorderRef.current = mediaRecorder;
      startedAtRef.current = Date.now();
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      clearTimer();
      // Derived from the clock, so a throttled or late tick can never skip or repeat a second.
      timerRef.current = setInterval(() => {
        setRecordingTime(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }, 250);
    } catch (error) {
      console.error('Error starting recording:', error);
      startingRef.current = false;
      mediaRecorderRef.current = null;
      releaseStream();
      alert(t('micAccessError'));
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      clearTimer();
      setIsRecording(false);
      recorder.stop();
    }
  };

  const handleRecordClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/20 z-[100]"
        onClick={!isRecording ? onClose : undefined}
      />
      
      {/* Popup */}
      <div style={{ right: FLOATING_ADD_POPUP_RIGHT }} className="fixed bottom-[5.5rem] z-[110] bg-card border rounded-2xl shadow-xl p-4 w-[200px]">
        <div className="flex flex-col items-center gap-2">
          <Button
            onClick={handleRecordClick}
            className={`h-16 w-16 rounded-full flex items-center justify-center transition-all ${
              isRecording 
                ? 'bg-red-500 hover:bg-red-600 text-white' 
                : 'bg-primary hover:bg-primary/90 text-primary-foreground'
            }`}
          >
            {isRecording ? <Square size={24} /> : <Mic size={24} />}
          </Button>
          
          {isRecording && (
            <div className="text-center">
              <div className="text-red-500 font-medium">{t('recordingInProgress')}</div>
              <div className="text-sm text-muted-foreground">{formatTime(recordingTime)}</div>
            </div>
          )}
          
          {!isRecording && recordingTime === 0 && (
            <p className="text-sm text-muted-foreground text-center">
              {t('tapToRecord')}
            </p>
          )}
        </div>
      </div>
    </>
  );
}