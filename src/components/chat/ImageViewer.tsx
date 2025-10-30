import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, X, Download } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Attachment } from '@/types';
import { cn } from '@/lib/utils';

interface ImageViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  images: Attachment[];
  startIndex?: number;
}

// Variants for the sliding animation
const variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? '100%' : '-100%',
    opacity: 0,
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? '100%' : '-100%',
    opacity: 0,
  }),
};

export function ImageViewer({ open, onOpenChange, images, startIndex = 0 }: ImageViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [direction, setDirection] = useState(0);

  useEffect(() => {
    if (open) {
      setCurrentIndex(startIndex);
    }
  }, [open, startIndex]);

  const paginate = (newDirection: number) => {
    setDirection(newDirection);
    if (newDirection > 0) {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    } else {
      setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    }
  };

  const handleDownload = () => {
    const currentImage = images[currentIndex];
    if (currentImage?.url) {
      const link = document.createElement('a');
      link.href = currentImage.url;
      link.download = `image_${currentIndex + 1}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const currentImage = images[currentIndex];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 bg-black/80 border-0 max-w-[95vw] max-h-[95vh] h-full w-full flex flex-col gap-0 backdrop-blur-sm [&>button]:hidden">
        {/* Header */}
        <header className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/50 to-transparent">
          <div className="text-white font-medium">
            {currentIndex + 1} / {images.length}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={handleDownload}>
              <Download className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => onOpenChange(false)}>
              <X className="h-6 w-6" />
            </Button>
          </div>
        </header>

        {/* Main Image View */}
        <div className="flex-1 flex items-center justify-center relative overflow-hidden">
          <AnimatePresence initial={false} custom={direction}>
            <motion.img
              key={currentIndex}
              src={currentImage?.url}
              alt={`Image ${currentIndex + 1}`}
              className="absolute max-h-full max-w-full object-contain"
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: "tween", ease: "easeInOut", duration: 0.4 },
                opacity: { duration: 0.3 }
              }}
            />
          </AnimatePresence>
        </div>

        {/* Navigation Arrows */}
        {images.length > 1 && (
          <div>
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white bg-black/30 hover:bg-black/50 h-10 w-10"
              onClick={() => paginate(-1)}
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white bg-black/30 hover:bg-black/50 h-10 w-10"
              onClick={() => paginate(1)}
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          </div>
        )}

        {/* Thumbnail Strip */}
        {images.length > 1 && (
          <footer className="absolute bottom-0 left-0 right-0 z-10 p-4 flex justify-center bg-gradient-to-t from-black/50 to-transparent">
            <div className="flex gap-2 p-2 bg-black/30 rounded-lg">
              {images.map((image, index) => (
                <div
                  key={image.id || index}
                  className={cn(
                    "h-14 w-14 rounded-md cursor-pointer border-2 transition-all",
                    currentIndex === index ? 'border-primary' : 'border-transparent hover:border-white/50'
                  )}
                  onClick={() => setCurrentIndex(index)}
                >
                  <img
                    src={image.url}
                    alt={`Thumbnail ${index + 1}`}
                    className="h-full w-full object-cover rounded"
                  />
                </div>
              ))}
            </div>
          </footer>
        )}
      </DialogContent>
    </Dialog>
  );
}