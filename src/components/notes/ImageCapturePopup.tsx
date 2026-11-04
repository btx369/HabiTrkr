import { useRef } from 'react';
import { Camera, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { readImageForStorage } from '@/lib/imageCompression';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';

interface ImageCapturePopupProps {
  isOpen: boolean;
  onImageSelect: (imageUrl: string) => void;
  onClose: () => void;
}

export function ImageCapturePopup({ isOpen, onImageSelect, onClose }: ImageCapturePopupProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useLanguage();
  const { theme } = useTheme();

  if (!isOpen) return null;

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      readImageForStorage(file).then((imageUrl) => {
        onImageSelect(imageUrl);
        onClose();
      });
    } else {
      onClose();
    }
  };

  const openCamera = () => {
    if (fileInputRef.current) {
      fileInputRef.current.setAttribute('capture', 'environment');
      fileInputRef.current.click();
    }
  };

  const openGallery = () => {
    if (fileInputRef.current) {
      fileInputRef.current.removeAttribute('capture');
      fileInputRef.current.click();
    }
  };

  const buttonClass = `h-10 px-6 rounded-full flex items-center gap-3 w-[120px] justify-start ${
    theme === 'dark' ? 'hover:bg-muted' : 'hover:bg-[hsl(30_8%_88%)]'
  }`;

  return (
    <>
      {/* Same scrim and buttons as the note-type popup it follows (no white card). */}
      <div className="fixed inset-0 bg-black/40 z-[100]" onClick={onClose} />

      <div className="fixed bottom-[5.5rem] right-2 z-[110] flex flex-col gap-3">
        <Button onClick={openCamera} variant="secondary" className={buttonClass}>
          <Camera size={20} />
          <span className="font-medium">{t('takePhoto')}</span>
        </Button>
        <Button onClick={openGallery} variant="secondary" className={buttonClass}>
          <Image size={20} />
          <span className="font-medium">{t('addImage')}</span>
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </>
  );
}
