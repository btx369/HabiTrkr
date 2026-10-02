import { FileText, List, Mic, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NoteType } from '@/types/note';
import { useTheme } from '@/contexts/ThemeContext';

interface NoteTypePopupProps {
  isOpen: boolean;
  onTypeSelect: (type: NoteType) => void;
  onClose: () => void;
}

export function NoteTypePopup({ isOpen, onTypeSelect, onClose }: NoteTypePopupProps) {
  const { theme } = useTheme();
  if (!isOpen) return null;

  const noteTypes = [
    { type: 'audio' as NoteType, icon: Mic, label: 'Audio' },
    { type: 'image' as NoteType, icon: Camera, label: 'Image' },
    { type: 'list' as NoteType, icon: List, label: 'List' },
    { type: 'text' as NoteType, icon: FileText, label: 'Text' },
  ];

  return (
    <>
      {/*
        * Backdrop.
        *
        * 40% rather than 20%: the point of the scrim is to dim the notes enough that the
        * four options read as the thing to look at, and at 20% the list behind stayed loud
        * enough to compete. Measured against screenshots at 20 / 35 / 50 / 65, this is the
        * strength where the list recedes without the page looking switched off.
        */}
      <div 
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />
      
      {/* Popup */}
      <div className="fixed bottom-36 right-2 z-50 flex flex-col gap-3">
        {noteTypes.map(({ type, icon: Icon, label }) => (
            <Button
              key={type}
              onClick={() => onTypeSelect(type)}
              variant="secondary"
              /*
               * The hover fill must be OPAQUE.
               *
               * The `secondary` variant hovers with `bg-secondary/80`, and these buttons sit
               * over the note list with only a 20% scrim behind them. At 80% alpha the cards
               * showed straight through the button — hovering "Audio" let you read the page
               * title and the tabs underneath it. A translucent hover only works where
               * something opaque sits behind the element; here nothing does.
               *
               * The tone is branched rather than written as `dark:` utilities, because a
               * `dark:` class outranks a plain `hover:` one and would kill the hover in the
               * dark theme — the same trap the editor footer buttons hit.
               */
              className={`h-10 px-6 rounded-full flex items-center gap-3 w-[110px] justify-start ${
                theme === 'dark' ? 'hover:bg-muted' : 'hover:bg-[hsl(30_8%_88%)]'
              }`}
            >
            <Icon size={20} />
            <span className="font-medium">{label}</span>
          </Button>
        ))}
      </div>
    </>
  );
}