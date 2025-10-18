import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import ReactConfetti from 'react-confetti';
import { useWindowSize } from '@/hooks/useWindowSize';

interface ConfettiContextType {
  showConfetti: () => void;
}

const ConfettiContext = createContext<ConfettiContextType | undefined>(undefined);

export function ConfettiProvider({ children }: { children: ReactNode }) {
  const [isConfettiActive, setIsConfettiActive] = useState(false);
  const { width, height } = useWindowSize();

  const showConfetti = useCallback(() => {
    setIsConfettiActive(true);
  }, []);

  const handleConfettiComplete = () => {
    setIsConfettiActive(false);
  };

  return (
    <ConfettiContext.Provider value={{ showConfetti }}>
      {children}
      {isConfettiActive && width && height && (
        <ReactConfetti
          width={width}
          height={height}
          recycle={false}
          numberOfPieces={500}
          gravity={0.25}
          wind={0.03}
          tweenDuration={6000}
          colors={['#3b82f6', '#f97316', '#22c55e', '#facc15']}
          onConfettiComplete={handleConfettiComplete}
        />
      )}
    </ConfettiContext.Provider>
  );
}

export function useConfetti() {
  const context = useContext(ConfettiContext);
  if (context === undefined) {
    throw new Error('useConfetti must be used within a ConfettiProvider');
  }
  return context;
}