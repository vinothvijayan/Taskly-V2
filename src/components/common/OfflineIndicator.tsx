import { useState } from 'react';
import { Badge } from '../ui/badge';
import { Wifi, WifiOff, CloudOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { ConflictResolutionDialog } from './ConflictResolutionDialog';

export function OfflineIndicator() {
  const { syncStatus, manualSync, getConflicts } = useOfflineSync();
  const [showConflicts, setShowConflicts] = useState(false);
  const [conflicts, setConflicts] = useState<{ tasks: any[]; notes: any[] }>({ tasks: [], notes: [] });

  const handleManualSync = async () => {
    if (!syncStatus.isOnline || syncStatus.isSyncing) return;
    await manualSync();
  };

  const handleShowConflicts = async () => {
    const conflictData = await getConflicts();
    setConflicts(conflictData);
    setShowConflicts(true);
  };

  if (syncStatus.isOnline && syncStatus.pending === 0 && syncStatus.conflicted === 0) {
    return null; // Don't show indicator when online and no pending actions
  }

  return (
    <>
      <div className="fixed top-20 right-4 z-50 flex flex-col gap-2">
        <Badge 
          variant={syncStatus.isOnline ? "default" : "destructive"}
          className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={handleManualSync}
        >
          {syncStatus.isOnline ? (
            <>
              {syncStatus.isSyncing ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : (
                <Wifi className="h-3 w-3" />
              )}
              {syncStatus.pending > 0 && (
                <span>Syncing {syncStatus.pending} items</span>
              )}
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3" />
              <span>Offline</span>
              {syncStatus.pending > 0 && (
                <>
                  <CloudOff className="h-3 w-3" />
                  <span>{syncStatus.pending} pending</span>
                </>
              )}
            </>
          )}
        </Badge>

        {syncStatus.conflicted > 0 && (
          <Badge 
            variant="destructive"
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={handleShowConflicts}
          >
            <AlertTriangle className="h-3 w-3" />
            <span>{syncStatus.conflicted} conflicts</span>
          </Badge>
        )}
      </div>

      <ConflictResolutionDialog
        open={showConflicts}
        onOpenChange={setShowConflicts}
        conflicts={conflicts}
      />
    </>
  );
}