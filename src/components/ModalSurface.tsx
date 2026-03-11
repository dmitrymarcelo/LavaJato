import React, { useEffect } from 'react';
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
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const centered = position === 'center';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className={`fixed inset-0 flex justify-center p-4 bg-black/40 backdrop-blur-sm ${centered ? 'items-center' : 'items-end sm:items-center'} ${overlayClassName}`}
    >
      <motion.div
        initial={centered ? { opacity: 0, scale: 0.96 } : { y: '100%' }}
        animate={centered ? { opacity: 1, scale: 1 } : { y: 0 }}
        exit={centered ? { opacity: 0, scale: 0.96 } : { y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        onClick={(event) => event.stopPropagation()}
        className={`w-full max-h-[88vh] overflow-y-auto overscroll-contain scroll-smooth bg-white shadow-2xl ${centered ? 'rounded-3xl' : 'rounded-t-[32px] sm:rounded-3xl'} ${panelClassName}`}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
