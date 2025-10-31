import { FieldValue } from "firebase/firestore"; // Import FieldValue

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  phoneNumber?: string;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt: string;
  preferences?: {
    notifications: boolean;
    theme: 'light' | 'dark' | 'system';
    language: string;
  };
  teamId?: string; // ID of the team this user belongs to
  role?: 'superadmin' | 'admin' | 'user'; // Added for role-based access control
}

export interface Team {
  id: string;
  memberIds: string[];
  createdAt: any; // Firebase Timestamp or Date
  createdBy: string;
}

// New Subtask interface
export interface Subtask {
  id: string;
  title: string;
  isCompleted: boolean;
  createdAt: string;
  completedAt?: string; // ISO string when subtask was completed
  timeSpent?: number; // time spent on subtask in seconds
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: "low" | "medium" | "high";
  status: "todo" | "in-progress" | "completed";
  dueDate?: string;
  estimatedTime?: number; // in minutes
  completedTime?: number; // in minutes
  completedAt?: string | FieldValue; // ISO string when task was completed, or FieldValue for deletion
  timeSpent?: number; // total time spent on task in seconds
  teamId?: string; // ID of the team this task belongs to
  assignedTo?: string[]; // Array of user UIDs assigned to this task
  createdBy?: string; // UID of the user who created this task
  createdAt: string;
  subtasks?: Subtask[]; // Array of subtasks
  lastCommentedAt?: string; // New field to track last comment activity
  planId?: string; // ID of the plan this task belongs to
  project?: string; // Project tag/category for the task
}

export interface Plan {
  id: string;
  title: string;
  shortDescription?: string;
  description?: string;
  status: 'Not Started' | 'In Progress' | 'Completed';
  teamId: string;
  createdBy: string;
  createdAt: string; // ISO string
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: 'task-assignment' | 'task-complete' | 'pomodoro-complete' | 'team-request' | 'general' | 'chat'; // Added 'chat'
  read: boolean;
  timestamp: string;
  data?: {
    taskId?: string;
    taskTitle?: string;
    assignerName?: string;
    teamId?: string;
    [key: string]: any;
  };
}

export interface Attachment {
  id: string;
  type: 'image' | 'video' | 'document' | 'audio';
  url: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  previewUrl?: string;
  status?: 'uploading' | 'sent' | 'failed';
  duration?: number; // for audio/video
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderEmail: string;
  senderAvatar?: string;
  message: string; // Caption for attachments, or text content
  timestamp: number;
  type: 'text' | 'system' | 'media';
  attachments?: Attachment[];
}

export interface ChatRoom {
  id: string;
  participants: string[];
  lastMessage?: ChatMessage;
  lastActivity: number;
  createdAt: number;
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  userDisplayName: string;
  userPhotoURL?: string;
  content: string;
  createdAt: any; // Firebase Timestamp
  updatedAt?: any; // Firebase Timestamp
  isEdited: boolean;
}

export interface MeetingRecording {
  id: string;
  title: string;
  audioUrl: string;
  duration: number; // in seconds
  status: 'uploading' | 'processing' | 'completed' | 'failed';
  transcript?: string;
  translatedTranscript?: string;
  summary?: string;
  createdAt: string;
  createdBy: string;
  fileSize: number; // in bytes
  filePath?: string; // Added filePath
}

export interface Note {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: string; // ISO string
}

export interface Opportunity {
  id: string;
  stage: 'Interested Lead' | 'Meeting' | 'Follow-ups' | 'Deals' | 'Closed Won' | 'Closed Lost';
  title: string;
  value: number;
  contact: string;
  phone?: string;
  closeDate: string; // ISO string
  teamId: string;
  createdBy: string;
  createdAt: string; // ISO string
  notes?: Note[];
  meetingDate?: string;
  meetingStatus?: 'scheduled' | 'done';
}

export type ActivityType = 'TASK_CREATED' | 'TASK_COMPLETED' | 'COMMENT_ADDED' | 'SUBTASK_COMPLETED' | 'SUBTASK_CREATED';

export interface Activity {
  id: string;
  teamId: string;
  type: ActivityType;
  timestamp: any; // Firebase Timestamp
  actor: {
    uid: string;
    displayName: string;
    photoURL?: string;
  };
  task?: {
    id: string;
    title: string;
    subtasks?: Subtask[];
    timeSpent?: number;
  };
  subtask?: {
    id: string;
    title: string;
  };
  comment?: {
    contentPreview: string;
  };
  reactions?: {
    [emoji: string]: string[];
  };
}