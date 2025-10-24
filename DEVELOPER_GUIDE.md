# 📚 Taskly Developer Guide

This document serves as the primary reference for understanding the architecture, data flow, and implementation details of the Taskly application.

## 1. Core Technology Stack

Taskly is built on a modern, full-stack JavaScript/Python architecture.

| Category | Technology | Purpose | Implementation Location |
| :--- | :--- | :--- | :--- |
| **Frontend** | React, TypeScript, Vite | UI development and build tooling. | `src/` |
| **Styling** | Tailwind CSS, shadcn/ui | Utility-first styling and accessible components. | `src/components/ui/`, `src/globals.css`, `src/index.css` |
| **State Management** | React Context, TanStack Query | Global client state and server state/caching. | `src/contexts/`, `src/hooks/` |
| **Backend/DB** | Firebase (Firestore, RTDB, Storage) | Primary database, real-time chat, and file storage. | `src/lib/firebase.ts`, `firestore.rules`, `storage.rules` |
| **Backend Logic** | Firebase Cloud Functions (Python) | AI processing (Gemini), PDF generation (WeasyPrint), and API proxy. | `functions/` |
| **Mobile** | Capacitor | Packaging the web app for native iOS/Android. | `capacitor.config.ts`, `android/`, `src/lib/capacitorNotifications.ts` |
| **Forms** | React Hook Form, Zod | Form validation and state management. | Used across all form components. |

## 2. Application Architecture & Data Flow

The application follows a standard React/Context/Firebase pattern:

1.  **UI Components** (`src/components/`, `src/pages/`) interact with **Contexts**.
2.  **Contexts** (`src/contexts/`) manage client-side state and handle all direct interaction with **Firebase** (Firestore, RTDB).
3.  **Firebase** handles persistence, real-time updates, and triggers **Cloud Functions** for heavy lifting (AI, exports).

## 3. Feature Implementation Details

### 3.1. Authentication & User Management

| Feature | Implementation | Key Files |
| :--- | :--- | :--- |
| **Core Auth** | Firebase Auth (`@firebase/auth`) | `src/lib/firebase.ts` |
| **Context** | Manages user state, profile fetching, and sign-in methods. | `src/contexts/AuthContext.tsx` |
| **Universal Sign-In** | Logic to handle native Capacitor Google Auth fallback to web popup. | `src/lib/universalAuth.ts` |
| **User Profiles** | Stored in Firestore under the `users` collection. | `src/contexts/AuthContext.tsx` |

### 3.2. Task Management (Tasks & Kanban)

| Feature | Implementation | Key Files |
| :--- | :--- | :--- |
| **Data Model** | Tasks stored in Firestore (`users/{uid}/tasks` or `teams/{teamId}/tasks`). | `src/types/index.ts` (Task, Subtask interfaces) |
| **Context** | Handles CRUD operations, sorting, and real-time listeners for personal and team tasks. | `src/contexts/TasksContext.tsx` |
| **UI Components** | Displays task details, handles status toggling, and subtasks. | `src/components/tasks/TaskCard.tsx`, `src/components/tasks/SubtasksSection.tsx` |
| **Kanban Board** | Uses `@dnd-kit` for drag-and-drop functionality, updating task status on drop. | `src/components/tasks/KanbanBoard.tsx`, `src/components/tasks/KanbanColumn.tsx` |
| **Time Tracking** | Tracks time spent on tasks/subtasks, persisting session state to Firestore. | `src/contexts/TaskTimeTrackerContext.tsx` |

### 3.3. Team Collaboration & Chat

| Feature | Implementation | Key Files |
| :--- | :--- | :--- |
| **Real-time Messages** | Firebase Realtime Database (RTDB) for low-latency chat messages. | `src/lib/firebase.ts` (`rtdb`) |
| **Context** | Manages user presence, message sending, and unread counts. | `src/contexts/TeamChatContext.tsx` |
| **UI** | Displays chat list and message bubbles. | `src/pages/TeamChatPage.tsx` |
| **Notifications** | Monitors RTDB for new messages and triggers local/push notifications. | `src/components/mobile/ChatMessageNotifier.tsx` |

### 3.4. Meetly (AI Meeting Summarization)

| Feature | Implementation | Key Files |
| :--- | :--- | :--- |
| **Context** | Manages recording state, audio capture, and upload process. | `src/contexts/MeetlyContext.tsx` |
| **Audio Capture** | Uses `MediaRecorder` (Web) or Capacitor Media plugin (Native) to capture audio as a Blob. | `src/components/meetly/AudioRecorder.tsx` |
| **Processing Trigger** | Uploaded audio files trigger a Cloud Function via Firebase Storage. | `functions/meetly_processor.py` |
| **AI Logic** | Python function uses Google Gemini API for transcription, translation, and structured summary generation. | `functions/meetly_processor.py` |

### 3.5. Sales Tracker

| Feature | Implementation | Key Files |
| :--- | :--- | :--- |
| **Contact Data** | Stored in Firebase Realtime Database (`contacts` collection) for fast updates from the native dialer app. | `src/contexts/ContactsContext.tsx` |
| **Analytics** | Processes call history data locally to generate daily reports and metrics. | `src/lib/sales-tracker-data.ts`, `src/components/sales-tracker/AnalyticsView.tsx` |
| **Lead Generation** | Uses a Firebase Callable Function as a secure proxy to the Google Places API. | `functions/sales_tools.py`, `src/pages/SalesToolsPage.tsx` |
| **Opportunities** | Kanban board for managing sales pipeline stages. Data stored in Firestore. | `src/contexts/SalesOpportunityContext.tsx`, `src/pages/SalesOpportunityPage.tsx` |

### 3.6. Notifications & Offline Sync

| Feature | Implementation | Key Files |
| :--- | :--- | :--- |
| **Unified Service** | Routes notifications to the correct platform API (Capacitor, FCM, Web Notification API). | `src/lib/unifiedNotificationService.ts` |
| **PWA Scheduling** | Uses IndexedDB to persist and check scheduled notifications when the app is closed (Web/PWA only). | `src/lib/unifiedNotifications.ts`, `src/lib/indexedDB.ts` |
| **Offline Sync** | Intercepts network requests and queues CRUD actions in IndexedDB when offline. | `src/lib/offlineSync.ts`, `src/hooks/useOfflineSync.ts` |
| **Mobile Features** | Handles deep linking and PWA installation prompts. | `src/lib/mobileShortcuts.ts` |

## 4. Styling Conventions

All styling adheres strictly to the guidelines defined in `AI_RULES.md`:

-   **Utility-First:** Exclusively uses Tailwind CSS classes.
-   **Component Library:** All foundational UI elements are sourced from `shadcn/ui` (`@/components/ui/*`).
-   **Customization:** Custom components compose `shadcn/ui` primitives; direct modification of `shadcn/ui` files is prohibited.