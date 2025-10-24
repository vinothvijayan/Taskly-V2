# Taskly: AI-Powered Task Management & Collaboration App

Taskly is a modern, full-stack productivity application designed to help teams manage tasks, track focus time, and leverage AI for meeting summarization and wellness coaching. It is built as a Progressive Web App (PWA) and packaged for native mobile deployment using Capacitor.

## 🚀 Key Features

- **Universal Task Management:** Create, assign, and track tasks with priority, due dates, and time tracking.
- **AI-Powered Meetings (Meetly):** Record meetings and automatically generate transcripts, translations, and actionable summaries using Google Gemini.
- **Team Collaboration:** Real-time team chat and shared task boards (Kanban).
- **Sales Tracker:** Dedicated module for managing sales leads, call history, and analytics.
- **Cross-Platform:** Seamless experience across Web, iOS, and Android via Capacitor.
- **Offline Support:** PWA capabilities for offline data queuing and synchronization.

## 📚 Developer Guide & Architecture

For detailed information on the project architecture, data flow, component structure, and implementation specifics, please refer to the [**DEVELOPER GUIDE**](DEVELOPER_GUIDE.md).

## 🛠️ Tech Stack

This project utilizes a modern, high-performance stack:

| Category | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React, TypeScript, Vite | Fast development and type-safe UI |
| **Styling** | Tailwind CSS, shadcn/ui | Utility-first styling and accessible components |
| **Backend** | Firebase | Authentication, Firestore (Database), Cloud Storage, and Cloud Functions (Python/Gemini AI) |
| **State/Data** | TanStack Query | Server state management, caching, and data synchronization |
| **Routing** | React Router DOM | Client-side navigation |
| **Forms** | React Hook Form, Zod | Robust, type-safe form handling and validation |
| **Mobile** | Capacitor | Packaging the web app as native iOS/Android applications |
| **Icons** | Lucide React | Clean and consistent icon set |

## 💻 Getting Started

Follow these steps to set up the project locally for development.

### Prerequisites

- Node.js (v18+) and npm/yarn/bun
- Firebase CLI (for deploying functions)

### Installation

1. **Clone the repository:**
   ```bash
   git clone <YOUR_GIT_URL>
   cd <YOUR_PROJECT_NAME>
   ```

2. **Install dependencies:**
   ```bash
   npm install
   # or yarn install / bun install
   ```

3. **Configure Firebase:**
   Ensure your Firebase configuration is set up in `src/lib/firebase.ts`. You will need to replace the placeholder values with your actual project credentials.

4. **Start the development server:**
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:8080`.

### Backend Setup (Cloud Functions)

The application relies on Firebase Cloud Functions for AI processing (Meetly).

1. **Install Python dependencies:**
   The Python functions require `firebase-admin`, `google-generativeai`, `requests`, and `weasyprint`. These are listed in `functions/requirements.txt`.

2. **Set Gemini API Key:**
   Update the placeholder key in `functions/meetly_processor.py` and `functions/process_journal.py` with your actual Google Gemini API Key.

3. **Deploy Functions:**
   The functions are deployed automatically during the build process in the current environment. If deploying manually via Firebase CLI:
   ```bash
   firebase deploy --only functions
   ```

## 📂 Project Structure

The core application logic resides in the `src/` directory:

```
src/
├── components/          # Reusable UI components (e.g., TaskCard, TaskForm)
│   ├── ui/              # Shadcn/ui components (untouched)
│   └── layout/          # Main application layout and header
├── contexts/            # Global state management using React Context (Auth, Tasks, Meetly, etc.)
├── hooks/               # Custom React hooks (e.g., useSound, useOfflineSync)
├── lib/                 # Core utilities and external service integrations (Firebase, Auth, Notifications)
├── pages/               # Top-level route components (DashboardPage, TasksPage, MeetlyPage)
├── types/               # TypeScript interface definitions
└── utils/               # Small, general-purpose utility functions
```

The backend code is located in the `functions/` directory:

```
functions/
├── main.py              # Entry point for Firebase Cloud Functions
├── meetly_processor.py  # Handles audio processing, transcription, and summarization
├── process_journal.py   # Handles journal entry processing and PDF export
└── sales_tools.py       # Secure proxy for Google Places API calls