import { useState, useEffect } from 'react';
import { Heading1, Heading2, Type, Bold, Italic, Underline, RemoveFormatting, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Editor } from '@tiptap/react';
import { isDefaultColor } from '@/lib/cardColorStyles';
import { getColoredIconButtonStyles, getColoredIconClass } from '@/lib/coloredButtonStyles';

interface TextFormattingBarProps {
  onFormat: (formatType: 'h1' | 'h2' | 'normal' | 'bold' | 'italic' | 'underline' | 'clear') => void;
  onClose?: () => void;
  editor: Editor | null;
  noteColor?: string;
}

export function TextFormattingBar({ onFormat, onClose, editor, noteColor }: TextFormattingBarProps) {
  const [isClosing, setIsClosing] = useState(false);

  const isH1Active = editor?.isActive('heading', { level: 1 }) ?? false;
  const isH2Active = editor?.isActive('heading', { level: 2 }) ?? false;
  const isNormalActive = editor?.isActive('paragraph') && !isH1Active && !isH2Active;
  const isBoldActive = editor?.isActive('bold') ?? false;
  const isItalicActive = editor?.isActive('italic') ?? false;
  const isUnderlineActive = editor?.isActive('underline') ?? false;

  // Use standardized color helpers for consistent styling
  const hasColor = noteColor && !isDefaultColor(noteColor);
  const iconButtonStyles = getColoredIconButtonStyles(!!hasColor);
  const iconColorClass = getColoredIconClass(!!hasColor);
  
  /*
   * Hover on an uncoloured note uses the shared --hover veil; on a coloured note the tint
   * comes from the note colour. (The comment here used to claim "black background with
   * white icons", which the code had already stopped doing.)
   */
  const themedHoverStyles = hasColor
    ? `${iconButtonStyles.className} ${iconColorClass}`
    : 'hover:bg-hover';
  
  // Container styling - no border-t here, parent BottomDock handles it
  const containerStyle = hasColor 
    ? { backgroundColor: noteColor } 
    : {};
  const containerClass = hasColor
    ? 'p-2'
    : 'backdrop-blur-sm bg-background/95 p-2';
  const dividerClass = hasColor ? 'bg-[#000000]/20' : 'bg-border';
  
  /*
   * Open/active state. On a coloured note this is a dark veil of the note's own colour; on
   * an uncoloured note it is a filled dark pill, which reads as "this control is engaged".
   */
  const activeButtonClass = hasColor
    ? 'bg-[#000000]/20 hover:bg-[#000000]/30 text-[#000000]'
    : 'bg-black text-white hover:bg-black/90';

  // Get button props based on active state
  const getButtonProps = (isActive: boolean) => ({
    className: `h-8 w-8 rounded-full p-0 ${isActive ? activeButtonClass : themedHoverStyles}`
  });

  const handleClose = () => {
    if (!onClose) return;
    setIsClosing(true);
  };

  useEffect(() => {
    if (isClosing && onClose) {
      const timer = setTimeout(() => {
        onClose();
      }, 150); // Match animation duration
      return () => clearTimeout(timer);
    }
  }, [isClosing, onClose]);

  return (
    <div 
      className={`${containerClass} ${isClosing ? 'animate-slide-down' : 'animate-slide-up'}`} 
      style={containerStyle}
    >
      <div className="flex items-center gap-1 justify-between overflow-x-auto">
        <div className="flex items-center gap-1">
          <Button
            {...getButtonProps(isH1Active)}
            size="sm"
            onClick={() => onFormat('h1')}
            title="Heading 1"
          >
            <Heading1 size={18} />
          </Button>
          <Button
            {...getButtonProps(isH2Active)}
            size="sm"
            onClick={() => onFormat('h2')}
            title="Heading 2"
          >
            <Heading2 size={18} />
          </Button>
          <Button
            {...getButtonProps(!!isNormalActive)}
            size="sm"
            onClick={() => onFormat('normal')}
            title="Normal text"
          >
            <Type size={18} />
          </Button>
          <div className={`w-px h-6 mx-1 ${dividerClass}`} />
          <Button
            {...getButtonProps(isBoldActive)}
            size="sm"
            onClick={() => onFormat('bold')}
            title="Bold"
          >
            <Bold size={18} />
          </Button>
          <Button
            {...getButtonProps(isItalicActive)}
            size="sm"
            onClick={() => onFormat('italic')}
            title="Italic"
          >
            <Italic size={18} />
          </Button>
          <Button
            {...getButtonProps(isUnderlineActive)}
            size="sm"
            onClick={() => onFormat('underline')}
            title="Underline"
          >
            <Underline size={18} />
          </Button>
          <div className={`w-px h-6 mx-1 ${dividerClass}`} />
          <Button
            size="sm"
            onClick={() => onFormat('clear')}
            className={`h-8 w-8 rounded-full p-0 ${themedHoverStyles}`}
            title="Clear formatting"
          >
            <RemoveFormatting size={18} />
          </Button>
        </div>
        {onClose && (
          <Button
            size="sm"
            onClick={handleClose}
            className={`h-8 w-8 rounded-full p-0 flex-shrink-0 ${themedHoverStyles}`}
            title="Close formatting bar"
          >
            <X size={18} />
          </Button>
        )}
      </div>
    </div>
  );
}
