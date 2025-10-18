import { useState, useEffect, useCallback, useRef } from 'react';
import { createRoot, Root } from 'react-dom/client';

interface PipWindow extends Window {
  reactRoot?: Root;
}

// Type guard for the experimental API
declare global {
  interface Window {
    documentPictureInPicture?: {
      requestWindow(options: { width: number; height: number }): Promise<PipWindow>;
      window: PipWindow | null;
      addEventListener(event: 'enter', handler: () => void): void;
    };
  }
}

export function usePictureInPicture() {
  const [isPipSupported, setIsPipSupported] = useState(false);
  const [pipWindow, setPipWindow] = useState<PipWindow | null>(null);
  const isPipOpen = !!pipWindow;

  useEffect(() => {
    setIsPipSupported('documentPictureInPicture' in window);
  }, []);

  const openPipWindow = useCallback(async (
    element: React.ReactNode,
    options: { width: number; height: number }
  ) => {
    if (!isPipSupported || !window.documentPictureInPicture) return;

    try {
      const newPipWindow = await window.documentPictureInPicture.requestWindow(options);
      
      // Copy stylesheets from the main document to the PiP window
      Array.from(document.styleSheets).forEach((styleSheet) => {
        try {
          const cssRules = Array.from(styleSheet.cssRules).map(rule => rule.cssText).join('');
          const style = newPipWindow.document.createElement('style');
          style.textContent = cssRules;
          newPipWindow.document.head.appendChild(style);
        } catch (e) {
          // Ignore CORS errors on external stylesheets
        }
      });

      // Create a root for React to render into
      const container = newPipWindow.document.createElement('div');
      container.id = 'react-root';
      newPipWindow.document.body.appendChild(container);
      
      // Use createRoot to render the React component
      const root = createRoot(container);
      root.render(element);
      newPipWindow.reactRoot = root;

      setPipWindow(newPipWindow);

      // Listen for the window being closed by the user
      newPipWindow.addEventListener('pagehide', () => {
        if (newPipWindow.reactRoot) {
          newPipWindow.reactRoot.unmount();
        }
        setPipWindow(null);
      });

      return newPipWindow;
    } catch (error) {
      console.error("Error opening Picture-in-Picture window:", error);
    }
  }, [isPipSupported]);

  const closePipWindow = useCallback(() => {
    if (pipWindow) {
      pipWindow.close();
      setPipWindow(null);
    }
  }, [pipWindow]);

  return {
    isPipSupported,
    isPipOpen,
    pipWindow,
    openPipWindow,
    closePipWindow,
  };
}