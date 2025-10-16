# AI Development Rules for Taskly App

This document outlines the technical stack and the rules for using various libraries and frameworks within this project. Following these guidelines ensures consistency, maintainability, and performance.

## Tech Stack

This is a modern, full-stack application built with the following technologies:

-   **Framework:** React with Vite for a fast development experience.
-   **Language:** TypeScript for type safety and improved developer experience.
-   **Styling:** Tailwind CSS for utility-first styling, integrated with shadcn/ui.
-   **UI Components:** shadcn/ui, which is a collection of beautifully designed, accessible components built on Radix UI.
-   **Backend & Database:** Firebase (Authentication, Firestore, Cloud Storage, and Cloud Functions) for all backend services.
-   **Native Mobile:** Capacitor to build and deploy the web app as a native Android and iOS application.
-   **Routing:** React Router (`react-router-dom`) for client-side navigation.
-   **Data Fetching & State:** TanStack Query (`@tanstack/react-query`) for managing server state, caching, and data fetching.
-   **Forms:** React Hook Form (`react-hook-form`) with Zod for robust and type-safe form validation.
-   **Icons:** Lucide React for a comprehensive and consistent set of icons.

## Library Usage Rules

### 1. Styling & UI

-   **Primary Styling:** All styling **must** be done using Tailwind CSS utility classes. Avoid writing custom CSS files unless absolutely necessary for complex, global styles.
-   **Component Library:** **Always** prioritize using components from the `shadcn/ui` library (`@/components/ui/*`). These are our foundational UI elements.
-   **Custom Components:** If a `shadcn/ui` component needs significant modification, create a new custom component in `src/components/` that composes the `shadcn/ui` component. **Do not** directly edit the files in `src/components/ui/`.
-   **Icons:** **Only** use icons from the `lucide-react` package.

### 2. State Management

-   **Local Component State:** Use React's built-in hooks (`useState`, `useReducer`) for state that is local to a single component.
-   **Server State & Caching:** **All** data fetching, caching, and server state management (e.g., tasks, user profiles from Firestore) **must** be handled by TanStack Query (`@tanstack/react-query`).
-   **Global Client State:** For simple, shared client-side state (e.g., theme, sidebar state), use React Context.

### 3. Forms

-   **All forms** must be built using `react-hook-form`.
-   **All form validation** must be handled using `zod` schemas, connected via `@hookform/resolvers/zod`.

### 4. Backend & Data Interaction

-   **All interactions** with Firebase services (Auth, Firestore, Storage, Functions) **must** use the initialized Firebase client from `src/lib/firebase.ts`.
-   Do not introduce other backend-as-a-service providers without discussion.

### 5. Routing & Navigation

-   **All client-side routing** must be handled by `react-router-dom`.
-   Keep all top-level route definitions within `src/App.tsx`.

### 6. Native Mobile Features

-   When accessing native device functionality (e.g., notifications, camera), **always** use the appropriate Capacitor plugin from the `@capacitor/*` scope.
-   Write platform-specific logic only when a unified Capacitor API is not available.

### 7. User Feedback

-   For non-blocking user feedback like "Task created" or "Profile updated," **always** use toast notifications via the `sonner` library. Use the helper functions in `src/utils/toast.ts`.
-   For actions that require user confirmation (e.g., deleting a task), use the `AlertDialog` component from `shadcn/ui`.