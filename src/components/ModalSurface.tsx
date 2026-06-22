import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from '../lib/motion';

type ModalSurfaceProps = {
  children: React.ReactNode;
  onClose: () => void;
  position?: 'bottom' | 'center';
  overlayClassName?: string;
  panelClassName?: string;
};

export default function ModalSurface({
  children,
  onClose,
  position = 'bottom',
  overlayClassName = '',
  panelClassName = '',
}: ModalSurfaceProps) {
  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const centered = position === 'center';

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className={`fixed inset-0 z-[140] flex overflow-y-auto overflow-x-hidden justify-center p-3 sm:p-4 bg-slate-200/70 backdrop-blur-sm ${centered ? 'items-center' : 'items-end sm:items-center'} ${overlayClassName}`}
    >
      <motion.div
        initial={centered ? { opacity: 0, scale: 0.96 } : { y: '100%' }}
        animate={centered ? { opacity: 1, scale: 1 } : { y: 0 }}
        exit={centered ? { opacity: 0, scale: 0.96 } : { y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        onClick={(event) => event.stopPropagation()}
        className={`no-scrollbar w-full shrink-0 max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto overflow-x-hidden overscroll-contain scroll-smooth bg-white shadow-2xl ${centered ? 'rounded-3xl' : 'rounded-t-[32px] sm:rounded-3xl'} ${panelClassName}`}
      >
        {children}
      </motion.div>
    </motion.div>,
    document.body
  );
}
