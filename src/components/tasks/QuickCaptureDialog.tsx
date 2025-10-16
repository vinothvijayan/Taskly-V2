// Quick task creation dialog — perfectly centered on mobile & desktop
import { useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Plus, Send, X } from "lucide-react";
import { useHapticFeedback } from "../../hooks/useTouchGestures";

interface QuickCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateTask?: (taskData: any) => void;
}

export function QuickCaptureDialog({
  open,
  onOpenChange,
  onCreateTask,
}: QuickCaptureDialogProps) {
  const [inputText, setInputText] = useState("");
  const { notification } = useHapticFeedback();

  const handleCreateTask = () => {
    if (!inputText.trim()) return;
    onCreateTask?.({ title: inputText.trim() });
    onOpenChange(false);
    setInputText("");
    notification("success");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleCreateTask();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* Dimmed overlay */}
        <DialogPrimitive.Overlay
          className="
            fixed inset-0 z-50 bg-black/50
            data-[state=open]:animate-in data-[state=closed]:animate-out
            data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0
          "
        />

        {/* Grid-centered container fixes mobile misalignment */}
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <DialogPrimitive.Content
            className="
              w-full max-w-md outline-none
              rounded-2xl border border-primary/20 bg-background shadow-2xl
              p-4 sm:p-6
              max-h-[calc(100svh-2rem)] overflow-y-auto
              data-[state=open]:animate-in data-[state=closed]:animate-out
              data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95
              data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0
            "
          >
            {/* Close button (top-right) */}
            <DialogPrimitive.Close
              className="
                absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center
                rounded-full hover:bg-muted/60 transition
              "
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>

            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-lg sm:text-xl font-bold">
                <div className="h-9 w-9 sm:h-10 sm:w-10 bg-primary/10 rounded-full flex items-center justify-center">
                  <Plus className="h-5 w-5 text-primary" />
                </div>
                Add Quick Task
              </DialogTitle>
              <DialogDescription className="text-sm sm:text-base">
                What would you like to accomplish?
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 pt-4">
              <Textarea
                placeholder="Describe your task..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={handleKeyPress}
                className="
                  min-h-[100px] sm:min-h-[120px]
                  text-sm sm:text-base leading-relaxed
                  border-2 border-muted focus:border-primary/50
                  rounded-xl resize-none
                "
                autoFocus
              />

              {/* Actions: stack on mobile, row on larger screens */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={() => onOpenChange(false)}
                  variant="outline"
                  className="flex-1 h-11 sm:h-12 rounded-xl border-2 hover:bg-muted/60 transition"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateTask}
                  disabled={!inputText.trim()}
                  variant="focus"
                  className="flex-1 h-11 sm:h-12 rounded-xl shadow-lg hover:shadow-xl transition"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Create Task
                </Button>
              </div>

              <p className="text-xs sm:text-sm text-muted-foreground text-center">
                Press Enter to create • Swipe to dismiss
              </p>
            </div>
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </Dialog>
  );
}
