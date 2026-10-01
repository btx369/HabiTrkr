import { FileText, List, Mic, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NoteType } from '@/types/note';

interface NoteTypePopupProps {
  isOpen: boolean;
  onTypeSelect: (type: NoteType) => void;
  onClose: () => void;
}

export function NoteTypePopup({ isOpen, onTypeSelect, onClose }: NoteTypePopupProps) {
  if (!isOpen) return null;

  const noteTypes = [
    { type: 'audio' as NoteType, icon: Mic, label: 'Audio' },
    { type: 'image' as NoteType, icon: Camera, label: 'Image' },
    { type: 'list' as NoteType, icon: List, label: 'List' },
    { type: 'text' as NoteType, icon: FileText, label: 'Text' },
  ];

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />
      
      {/* Popup */}
      <div className="fixed bottom-36 right-2 z-50 flex flex-col gap-3">
        {noteTypes.map(({ type, icon: Icon, label }) => (
            <Button
              key={type}
              onClick={() => onTypeSelect(type)}
              variant="secondary"
              className="h-10 px-6 rounded-full flex items-center gap-3 w-[110px] justify-start"
            >
            <Icon size={20} />
            <span className="font-medium">{label}</span>
          </Button>
        ))}
      </div>
    </>
  );
}