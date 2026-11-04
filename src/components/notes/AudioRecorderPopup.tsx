import { useState, useRef } from 'react';
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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (!isOpen) return null;

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
        // Label the data with the format the browser actually recorded (WebM on Chrome,
        // MP4 on Safari). Calling it WAV made Safari refuse to play it back.
        const mimeType = (mediaRecorder.mimeType || chunks[0]?.type || 'audio/webm').split(';')[0];
        const blob = new Blob(chunks, { type: mimeType });
        
        // Convert to base64 for persistence
        const reader = new FileReader();
        reader.onloadend = () => {
          const audioUrl = reader.result as string;
          onRecordingComplete(audioUrl, recordingTime);
          
          // Cleanup
          stream.getTracks().forEach(track => track.stop());
          setRecordingTime(0);
          if (timerRef.current) {
            clearInterval(timerRef.current);
          }
          onClose();
        };
        reader.readAsDataURL(blob);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
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
              <div className="text-red-500 font-medium">Recording...</div>
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