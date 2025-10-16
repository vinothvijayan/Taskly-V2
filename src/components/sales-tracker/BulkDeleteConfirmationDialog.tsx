import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface BulkDeleteConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  itemCount: number;
  itemName: string; // e.g., "call logs"
}

export function BulkDeleteConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  itemCount,
  itemName,
}: BulkDeleteConfirmationDialogProps) {
  const [confirmationText, setConfirmationText] = useState('');

  const isDeleteDisabled = confirmationText !== 'Delete This';

  const handleConfirm = () => {
    onConfirm();
    setConfirmationText('');
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setConfirmationText('');
    }
    onOpenChange(isOpen);
  };

  if (itemCount === 0) return null;

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete 
            <strong> {itemCount} selected {itemName}</strong>.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2 my-4">
          <Label htmlFor="delete-confirm">To confirm, type "Delete This" below:</Label>
          <Input
            id="delete-confirm"
            value={confirmationText}
            onChange={(e) => setConfirmationText(e.target.value)}
            autoComplete="off"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isDeleteDisabled}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}