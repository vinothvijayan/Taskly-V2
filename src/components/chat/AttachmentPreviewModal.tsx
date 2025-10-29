import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Send, Loader2, X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AttachmentPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: File[];
  onSend: (files: File[], caption: string) => Promise<void>;
}

export function AttachmentPreviewModal({ open, onOpenChange, files, onSend }: AttachmentPreviewModalProps) {
  const [caption, setCaption] = useState('');
  const [localFiles, setLocalFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const addMoreFilesInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && files.length > 0) {
      setLocalFiles(files);
      const urls = files.map(file => URL.createObjectURL(file));
      setPreviewUrls(urls);
      setActiveIndex(0);
    }

    // Cleanup function to revoke URLs when component unmounts or files change
    return () => {
      previewUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [open, files]);

  const handleSend = async () => {
    if (localFiles.length === 0) return;
    setIsSending(true);
    await onSend(localFiles, caption);
    setIsSending(false);
    onOpenChange(false); // This will trigger the reset in handleOpenChange
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setCaption('');
      setLocalFiles([]);
      setPreviewUrls(prev => {
        prev.forEach(url => URL.revokeObjectURL(url));
        return [];
      });
      setActiveIndex(0);
    }
    onOpenChange(isOpen);
  };

  const handleRemoveImage = (indexToRemove: number) => {
    URL.revokeObjectURL(previewUrls[indexToRemove]);

    const newFiles = localFiles.filter((_, index) => index !== indexToRemove);
    const newUrls = previewUrls.filter((_, index) => index !== indexToRemove);

    setLocalFiles(newFiles);
    setPreviewUrls(newUrls);

    if (newFiles.length === 0) {
      onOpenChange(false);
    } else if (activeIndex >= indexToRemove) {
      setActiveIndex(Math.max(0, activeIndex - 1));
    }
  };

  const handleAddMoreFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = event.target.files ? Array.from(event.target.files) : [];
    if (newFiles.length > 0) {
      const combinedFiles = [...localFiles, ...newFiles];
      const newUrls = newFiles.map(file => URL.createObjectURL(file));
      
      setLocalFiles(combinedFiles);
      setPreviewUrls(prev => [...prev, ...newUrls]);
    }
    // Reset file input to allow selecting the same file again
    if(event.target) event.target.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 bg-muted dark:bg-background flex flex-col h-[90vh] max-h-[700px] gap-0">
        <DialogHeader className="p-4 bg-background dark:bg-muted/50 flex-shrink-0">
          <DialogTitle>Send Image{localFiles.length > 1 && 's'}</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 flex items-center justify-center bg-black/80 p-4 relative overflow-hidden">
          {previewUrls[activeIndex] && (
            <img src={previewUrls[activeIndex]} alt="Preview" className="max-h-full max-w-full rounded-lg object-contain" />
          )}
        </div>

        <div className="p-4 bg-background dark:bg-muted/50 space-y-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <input type="file" ref={addMoreFilesInputRef} onChange={handleAddMoreFiles} accept="image/*" multiple className="hidden" />
            <Button variant="outline" size="icon" className="h-16 w-16 flex-shrink-0" onClick={() => addMoreFilesInputRef.current?.click()}>
              <Plus className="h-6 w-6" />
            </Button>
            <ScrollArea className="whitespace-nowrap">
              <div className="flex gap-2 pb-2">
                {previewUrls.map((url, index) => (
                  <div key={index} className="relative h-16 w-16 flex-shrink-0 cursor-pointer group" onClick={() => setActiveIndex(index)}>
                    <img src={url} alt={`Thumbnail ${index + 1}`} className={cn("h-full w-full object-cover rounded-md border-2 transition-all", activeIndex === index ? "border-primary" : "border-transparent group-hover:border-muted-foreground/50")} />
                    <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 h-5 w-5 rounded-full" onClick={(e) => { e.stopPropagation(); handleRemoveImage(index); }}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>

          <div className="flex items-center gap-2">
            <Input
              placeholder="Add a caption..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="flex-1 bg-muted dark:bg-background border-border h-10"
            />
            <Button onClick={handleSend} disabled={isSending || localFiles.length === 0} size="icon" className="h-10 w-10 bg-[#25D366] hover:bg-[#20B358] text-white flex-shrink-0 rounded-full">
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}