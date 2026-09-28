import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft, MoreVertical } from 'lucide-react';
import { ImageActionMenu } from '@/components/shared/ImageActionMenu';
import { ConfirmationDialog } from '@/components/shared/ConfirmationDialog';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from '@/components/ui/carousel';

interface ImageGalleryViewerProps {
  images: string[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onCopy?: (imageUrl: string) => void;
  onShare?: (imageUrl: string) => void;
  onDelete?: (imageUrl: string) => void;
}

export function ImageGalleryViewer({
  images,
  initialIndex,
  isOpen,
  onClose,
  onCopy,
  onShare,
  onDelete,
}: ImageGalleryViewerProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(initialIndex);
  const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);

  // Set initial slide when dialog opens
  useEffect(() => {
    if (api && isOpen) {
      api.scrollTo(initialIndex, true);
      setCurrent(initialIndex);
    }
  }, [api, isOpen, initialIndex]);

  // Update current index when carousel changes
  useEffect(() => {
    if (!api) return;

    const handleSelect = () => {
      setCurrent(api.selectedScrollSnap());
    };

    api.on('select', handleSelect);

    return () => {
      api.off('select', handleSelect);
    };
  }, [api]);

  // Download the current image
  const handleDownload = async () => {
    const imageUrl = images[current];
    try {
      // For base64 images, create a download link directly
      if (imageUrl.startsWith('data:')) {
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = `image-${current + 1}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // For URL images, fetch and download
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `image-${current + 1}.${blob.type.split('/')[1] || 'png'}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Failed to download image:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent 
        className="max-w-full w-full h-screen max-h-screen m-0 p-0 bg-black/95 border-none flex flex-col"
        hideCloseButton
        aria-labelledby="image-gallery-title"
        aria-describedby="image-gallery-description"
      >
          <DialogTitle className="sr-only" id="image-gallery-title">Image gallery</DialogTitle>
          <p id="image-gallery-description" className="sr-only">Full-screen image viewer. Swipe left or right to navigate. Use the back button to return to the note.</p>
          <div className="relative w-full h-full flex flex-col">
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/50 to-transparent">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              aria-label="Back to note"
              className="h-8 w-8 p-0 text-white hover:bg-white/20"
            >
              <ChevronLeft size={20} />
            </Button>
            <span className="text-white text-sm font-medium">
              {current + 1} / {images.length}
            </span>
            <ImageActionMenu
              onCopy={onCopy ? () => onCopy(images[current]) : undefined}
              onShare={onShare ? () => onShare(images[current]) : undefined}
              onDownload={handleDownload}
              onDelete={onDelete ? () => setDeleteAlertOpen(true) : undefined}
              trigger={
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-white hover:bg-white/20"
                  aria-label="Image options"
                >
                  <MoreVertical size={20} />
                </Button>
              }
            />
          </div>

          {/* Delete Confirmation Dialog */}
          {onDelete && (
            <ConfirmationDialog
              open={deleteAlertOpen}
              onOpenChange={setDeleteAlertOpen}
              title="Delete Image"
              description="Are you sure you want to permanently delete this image? This action cannot be undone."
              action="delete"
              onConfirm={() => onDelete(images[current])}
            />
          )}

          {/* Carousel */}
          <div className="flex-1 flex items-center justify-center min-h-0">
            <Carousel
              setApi={setApi}
              opts={{
                startIndex: initialIndex,
                loop: true,
                dragFree: false,
                containScroll: "trimSnaps",
                align: "center",
              }}
              className="w-full h-full touch-pan-x flex items-center justify-center"
            >
              <CarouselContent className="h-full -ml-0 items-center">
                {images.map((imageUrl, index) => (
                  <CarouselItem key={index} className="pl-0 basis-full h-full flex items-center justify-center">
                    <div className="w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing p-4">
                      <img
                        src={imageUrl}
                        alt={`Image ${index + 1}`}
                        className="max-w-[calc(100vw-2rem)] max-h-[calc(100vh-6rem)] w-auto h-auto object-contain select-none pointer-events-none"
                        draggable={false}
                      />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              
              {images.length > 1 && (
                <>
                  <CarouselPrevious className="left-4 h-10 w-10 bg-white/10 border-white/20 text-white hover:bg-white/20" />
                  <CarouselNext className="right-4 h-10 w-10 bg-white/10 border-white/20 text-white hover:bg-white/20" />
                </>
              )}
            </Carousel>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
