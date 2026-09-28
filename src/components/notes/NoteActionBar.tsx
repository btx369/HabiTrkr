import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { 
  Plus, 
  Camera, 
  Image as ImageIcon, 
  Mic, 
  CheckSquare,
  Tag,
  Bell,
  Type
} from 'lucide-react';
import { Note } from '@/types/note';
import { TagEditorPopover } from './TagEditorPopover';
import { isDefaultColor } from '@/lib/cardColorStyles';
import { getColoredOutlineButtonStyles, getColoredIconClass, getColoredBorderClass } from '@/lib/coloredButtonStyles';

interface NoteActionBarProps {
  note: Note;
  onSave: (noteId: string, updates: Partial<Note>) => void;
  onTakePhoto?: () => void;
  onAddImage?: () => void;
  onStartRecording?: () => void;
  onAddTickBoxes?: () => void;
  onRemindMe?: () => void;
  onTranscribeAudio?: () => void;
  onToggleFormatting?: () => void;
  showFormattingBar?: boolean;
  isTextNote?: boolean;
}

export const NoteActionBar = ({
  note,
  onSave,
  onTakePhoto,
  onAddImage,
  onStartRecording,
  onAddTickBoxes,
  onRemindMe,
  onTranscribeAudio,
  onToggleFormatting,
  showFormattingBar,
  isTextNote
}: NoteActionBarProps) => {
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isTagPopoverOpen, setIsTagPopoverOpen] = useState(false);
  
  const hasColor = !isDefaultColor(note.color);
  const outlineStyles = getColoredOutlineButtonStyles(hasColor);
  const iconColorClass = getColoredIconClass(hasColor);
  const borderClass = getColoredBorderClass(hasColor, 20);
  
  // Custom hover styles for action bar buttons on non-colored notes
  // Black background with white icons for consistent styling
  const themedHoverStyles = hasColor
    ? `${outlineStyles.className} ${iconColorClass}`
    : 'hover:bg-black hover:text-white border border-input';
  
  // Active state styling (when menu/popover is open)
  const activeStyles = hasColor
    ? `bg-[#000000]/20 text-[#000000]`
    : 'bg-black text-white';

  return (
    <div className={`flex items-center justify-center gap-2 p-3 ${hasColor ? 'bg-transparent' : 'bg-background/50 backdrop-blur-sm'}`}>
      <DropdownMenu onOpenChange={setIsAddMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button 
            size="sm" 
            className={`h-9 w-9 rounded-full p-0 ${isAddMenuOpen 
              ? activeStyles 
              : (hasColor ? `bg-[#000000]/20 hover:bg-[#000000]/30 ${iconColorClass}` : 'hover:bg-black hover:text-white')
            }`}
          >
            <Plus size={16} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" side="top" className="w-48 bg-background border border-border">
          <DropdownMenuItem onClick={onTakePhoto} className="flex items-center gap-2">
            <Camera size={16} />
            Take Photo
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onAddImage} className="flex items-center gap-2">
            <ImageIcon size={16} />
            Add image
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onStartRecording} className="flex items-center gap-2">
            <Mic size={16} />
            Recording
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onAddTickBoxes} className="flex items-center gap-2">
            <CheckSquare size={16} />
            Tick Boxes
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      
      <Popover onOpenChange={setIsTagPopoverOpen}>
        <PopoverTrigger asChild>
          <Button 
            size="sm" 
            className={`h-9 w-9 rounded-full p-0 ${isTagPopoverOpen ? activeStyles : themedHoverStyles}`}
          >
            <Tag size={16} />
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          side="top" 
          align="center" 
          className={`w-80 p-3 z-[60] ${hasColor ? borderClass : 'bg-popover'}`}
          style={hasColor ? { backgroundColor: note.color } : {}}
        >
          <TagEditorPopover 
            note={note} 
            onSave={onSave}
            noteColor={note.color}
          />
        </PopoverContent>
      </Popover>
      
      <Button 
        size="sm" 
        className={`h-9 w-9 rounded-full p-0 ${themedHoverStyles}`}
        onClick={onRemindMe}
      >
        <Bell size={16} />
      </Button>
      
      <Button 
        size="sm" 
        className={`h-9 w-9 rounded-full p-0 ${themedHoverStyles}`}
        onClick={onTranscribeAudio}
        title="Transcribe audio to text (Coming soon)"
      >
        <Mic size={16} />
      </Button>
      
      {isTextNote && onToggleFormatting && (
        <Button 
          size="sm" 
          className={`h-9 w-9 rounded-full p-0 ${showFormattingBar ? activeStyles : themedHoverStyles}`}
          onClick={onToggleFormatting}
        >
          <Type size={16} />
        </Button>
      )}
    </div>
  );
};
