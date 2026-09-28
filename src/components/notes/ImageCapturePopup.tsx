import { useRef } from 'react';
import { Camera, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ImageCapturePopupProps {
  isOpen: boolean;
  onImageSelect: (imageUrl: string) => void;
  onClose: () => void;
}

export function ImageCapturePopup({ isOpen, onImageSelect, onClose }: ImageCapturePopupProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const imageUrl = reader.result as string;
        onImageSelect(imageUrl);
        onClose();
      };
      reader.readAsDataURL(file);
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

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/20 z-[100]"
        onClick={onClose}
      />
      
      {/* Popup */}
      <div className="fixed bottom-40 right-4 z-[110] bg-card border rounded-2xl shadow-xl p-6 min-w-[200px]">
        <div className="flex flex-col items-center gap-4">
          <Button
            onClick={openCamera}
            className="h-12 w-full rounded-full bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-3 justify-center"
          >
            <Camera size={20} />
            <span className="font-medium">Take Photo</span>
          </Button>
          <Button
            onClick={openGallery}
            className="h-12 w-full rounded-full bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-3 justify-center"
          >
            <Image size={20} />
            <span className="font-medium">Choose from Device</span>
          </Button>
        </div>
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