import { useState, useEffect, useCallback, ReactNode } from 'react';
import { createRoot, Root } from 'react-dom/client';

// Define the custom window type to include our React root
interface PipWindow extends Window {
  reactRoot?: Root;
}

export function usePipWidgetManager() {
  const [isPipSupported, setIsPipSupported] = useState(false);
  const [isPipOpen, setIsPipOpen] = useState(false);
  const [pipWindow, setPipWindow] = useState<PipWindow | null>(null);

  // Check for Picture-in-Picture API support on component mount
  useEffect(() => {
    setIsPipSupported('documentPictureInPicture' in window);
  }, []);

  // Function to close the PiP window
  const closePipWindow = useCallback(() => {
    if (pipWindow) {
      pipWindow.close();
      setPipWindow(null);
      setIsPipOpen(false);
    }
  }, [pipWindow]);

  // Function to open the PiP window and render React content inside it
  const openPipWindow = useCallback(async (pipContent: ReactNode, options: { width: number; height: number }) => {
    if (!isPipSupported || isPipOpen) return;

    try {
      const newPipWindow: PipWindow = await (window as any).documentPictureInPicture.requestWindow({
        width: options.width,
        height: options.height,
      });

      // Inject styles and a root element for React to mount into
      const style = newPipWindow.document.createElement('style');
      style.textContent = `
        body { margin: 0; background-color: #111827; color: #f9fafb; font-family: sans-serif; overflow: hidden; }
        #root { height: 100vh; width: 100vw; }
      `;
      newPipWindow.document.head.appendChild(style);
      const mountPoint = newPipWindow.document.createElement('div');
      mountPoint.id = 'root';
      newPipWindow.document.body.appendChild(mountPoint);

      // Create a new React root in the PiP window and render the content
      const reactRoot = createRoot(mountPoint);
      reactRoot.render(pipContent);
      newPipWindow.reactRoot = reactRoot; // Store the root for later updates

      setPipWindow(newPipWindow);
      setIsPipOpen(true);

      // Listen for the window closing to update our state
      newPipWindow.addEventListener('pagehide', () => {
        setPipWindow(null);
        setIsPipOpen(false);
      });
    } catch (error) {
      console.error("Error opening Picture-in-Picture window:", error);
    }
  }, [isPipSupported, isPipOpen]);

  return { isPipSupported, isPipOpen, pipWindow, openPipWindow, closePipWindow };
}