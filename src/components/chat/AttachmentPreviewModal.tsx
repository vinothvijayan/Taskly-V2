import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2 } from 'lucide-react';

interface AttachmentPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: File | null;
  onSend: (file: File, caption: string) => Promise<void>;
}

export function AttachmentPreviewModal({ open, onOpenChange, file, onSend }: AttachmentPreviewModalProps) {
  const [caption, setCaption] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file]);

  const handleSend = async () => {
    if (!file) return;
    setIsSending(true);
    await onSend(file, caption);
    setIsSending(false);
    onOpenChange(false);
  };

  // Reset state when modal closes
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setCaption('');
      setPreviewUrl(null);
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md p-0 bg-muted dark:bg-background">
        <DialogHeader className="p-4 bg-background dark:bg-muted/50">
          <DialogTitle>Send Image</DialogTitle>
        </DialogHeader>
        <div className="p-4 flex flex-col items-center justify-center bg-black/50">
          {previewUrl && (
            <img src={previewUrl} alt="Preview" className="max-h-[50vh] max-w-full rounded-lg object-contain" />
          )}
        </div>
        <DialogFooter className="p-4 bg-background dark:bg-muted/50 flex-col sm:flex-col sm:space-x-0 items-stretch gap-2">
          <Textarea
            placeholder="Add a caption..."
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className="bg-muted dark:bg-background border-border"
            rows={2}
          />
          <Button onClick={handleSend} disabled={isSending} className="w-full bg-[#25D366] hover:bg-[#20B358] text-white">
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}