import { Task } from '@/types';

const VIEWED_TIMESTAMPS_KEY = 'taskly_viewed_timestamps';

interface ViewedTimestamps {
  [taskId: string]: string; // ISO string timestamp
}

function getViewedTimestamps(): ViewedTimestamps {
  try {
    const stored = localStorage.getItem(VIEWED_TIMESTAMPS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error('Error reading viewed timestamps from localStorage:', error);
    return {};
  }
}

function saveViewedTimestamps(timestamps: ViewedTimestamps): void {
  try {
    localStorage.setItem(VIEWED_TIMESTAMPS_KEY, JSON.stringify(timestamps));
  } catch (error) {
    console.error('Error saving viewed timestamps to localStorage:', error);
  }
}

export function setTaskAsViewed(taskId: string, lastCommentedAt: string): void {
  if (!taskId || !lastCommentedAt) return;
  const timestamps = getViewedTimestamps();
  timestamps[taskId] = lastCommentedAt;
  saveViewedTimestamps(timestamps);
}

export function getLastViewedTimestamp(taskId: string): string | null {
  const timestamps = getViewedTimestamps();
  return timestamps[taskId] || null;
}

export function hasUnreadComments(task: Task): boolean {
  if (!task.lastCommentedAt) {
    return false;
  }
  const lastViewed = getLastViewedTimestamp(task.id);
  if (!lastViewed) {
    // If there's a comment timestamp but no viewed timestamp, it's unread.
    return true;
  }
  // It's unread if the last comment is more recent than the last time it was viewed.
  return new Date(task.lastCommentedAt) > new Date(lastViewed);
}