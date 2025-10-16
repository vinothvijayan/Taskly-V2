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
import { CallLog } from "@/lib/sales-tracker-data";
import { format } from 'date-fns';

interface DeleteLogConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  logDetails: { contactName: string; log: CallLog } | null;
}

export function DeleteLogConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  logDetails,
}: DeleteLogConfirmationDialogProps) {
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

  if (!logDetails) return null;

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the call log for 
            <strong> {logDetails.contactName}</strong> from 
            <strong> {format(new Date(logDetails.log.timestamp), 'PP')}</strong>.
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