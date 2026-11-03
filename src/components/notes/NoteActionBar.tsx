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
import { getColoredBorderClass } from '@/lib/coloredButtonStyles';
import { useLanguage } from '@/contexts/LanguageContext';

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
  const { t } = useLanguage();
  const hasColor = !isDefaultColor(note.color);
  const borderClass = getColoredBorderClass(hasColor, 20);
  
  /*
   * Every button in this bar shares one set of states — Add, Tags, Alerts, Audio and Text
   * Format. They used to diverge: Add baked a permanent `bg-[#000000]/20` into its resting
   * state, so on a coloured note it sat visibly darker than its neighbours, while Tags and
   * Text Format kept a hover tint even when open.
   *
   *   rest    transparent — the buttons are glyphs on the note, nothing more
   *   hover   the note-colour veil, or the shared --hover veil on a plain note
   *   active  solid black with a white glyph, held until the control is closed
   *
   * The active fill is deliberately the same on a coloured note as on a plain one. A
   * translucent veil of the note's own colour was tried first and was not readable: on a
   * pale note (#FEF3C7) the open state and the hover state looked alike, so "something is
   * open" stopped being obvious. Solid black contrasts with every note colour there is.
   *
   * Do NOT add `bg-transparent` to the shared part of these strings. `.bg-transparent` and
   * `.bg-black` have identical specificity, so the one Tailwind emits LAST wins — and it
   * emits `.bg-transparent` after `.bg-black`. A resting `bg-transparent` alongside a
   * `bg-black` active state therefore makes the active state silently invisible. Keeping the
   * background inside mutually exclusive branches lets tailwind-merge drop the loser, which
   * is why `bg-transparent` appears only in the branch that needs it.
   */
  const sizeStyles = 'h-9 w-9 rounded-full p-0';
  const restStyles = hasColor
    ? 'bg-transparent hover:bg-black/10'
    : 'bg-transparent hover:bg-hover';

  /*
   * `data-[state=open]` only exists on the Radix triggers (Add, Tags), which set that
   * attribute themselves. Text Format is a plain toggle button, so the attribute never
   * appears and that rule never fired — it was the one button in the bar that did not stay
   * black. It reports the same state through `aria-pressed` instead, which is also the
   * accessible way to express a toggle.
   */
  const openTriggerStyles = 'data-[state=open]:bg-black data-[state=open]:text-white';
  const activeButtonStyles = 'bg-black text-white hover:bg-black';

  return (
    <div className={`flex items-center justify-center gap-2 p-3 ${hasColor ? 'bg-transparent' : 'bg-background/50 backdrop-blur-sm'}`}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            size="sm" 
            className={`${sizeStyles} ${restStyles} ${openTriggerStyles}`}
            aria-label={t('add')}
          >
            <Plus size={16} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" side="top" className="w-48 bg-background border border-border">
          <DropdownMenuItem onClick={onTakePhoto} className="flex items-center gap-2">
            <Camera size={16} />
            {t('takePhoto')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onAddImage} className="flex items-center gap-2">
            <ImageIcon size={16} />
            {t('addImage')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onStartRecording} className="flex items-center gap-2">
            <Mic size={16} />
            {t('recording')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onAddTickBoxes} className="flex items-center gap-2">
            <CheckSquare size={16} />
            {t('tickBoxes')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      
      <Popover>
        <PopoverTrigger asChild>
          <Button 
            size="sm" 
            className={`${sizeStyles} ${restStyles} ${openTriggerStyles}`}
            aria-label={t('tags')}
          >
            <Tag size={16} />
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          side="top" 
          align="center" 
          // Same surface as the Add dropdown beside it: --popover, not a literal. On a
          // coloured note the tint stays, since the panel sits on that colour.
          className={`w-80 p-3 z-[60] ${hasColor ? borderClass : 'bg-popover border-border'}`}
          style={hasColor ? { backgroundColor: note.color } : {}}
        >
          <TagEditorPopover 
            note={note} 
            onSave={onSave}
            noteColor={note.color}
          />
        </PopoverContent>
      </Popover>
      
      {/* Reminders and transcription are not built yet: show their buttons only once a
          handler exists, instead of buttons that do nothing when tapped. */}
      {onRemindMe && (
        <Button 
          size="sm" 
          className={`${sizeStyles} ${restStyles}`}
          onClick={onRemindMe}
          aria-label={t('alert')}
        >
          <Bell size={16} />
        </Button>
      )}
      
      {onTranscribeAudio && (
        <Button 
          size="sm" 
          className={`${sizeStyles} ${restStyles}`}
          onClick={onTranscribeAudio}
          aria-label={t('transcribeAudio')}
        >
          <Mic size={16} />
        </Button>
      )}
      
      {isTextNote && onToggleFormatting && (
        <Button 
          size="sm" 
          className={`${sizeStyles} ${showFormattingBar ? activeButtonStyles : restStyles}`}
          aria-pressed={showFormattingBar}
          aria-label={t('textFormatting')}
          onClick={onToggleFormatting}
        >
          <Type size={16} />
        </Button>
      )}
    </div>
  );
};
