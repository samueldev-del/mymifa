'use client';

import { useEffect, useRef } from 'react';

interface ModalProps {
  onClose: () => void;
  /** Titre accessible, lu par les lecteurs d'écran. */
  labelledBy: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Coquille commune aux modales : fermeture par Échap et par clic sur le fond,
 * verrouillage du défilement, focus déplacé dans la boîte à l'ouverture.
 */
export default function Modal({ onClose, labelledBy, children, className = '' }: ModalProps) {
  const boiteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKeyDown);

    const overflowInitial = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    boiteRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflowInitial;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-littoral-dark/50 p-4 backdrop-blur-sm"
      // Ne ferme que sur le fond lui-même, pas sur un clic relâché dans la boîte.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={boiteRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={`animate-fade-in flex max-h-[90vh] w-full flex-col overflow-hidden rounded-3xl bg-white shadow-2xl outline-none ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
