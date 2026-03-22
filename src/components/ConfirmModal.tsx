import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  showCancel?: boolean;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = '削除する',
  cancelText = 'キャンセル',
  variant = 'danger',
  showCancel = true
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden"
          >
            {/* Background Accent */}
            <div className={`absolute top-0 left-0 w-full h-1 ${
              variant === 'danger' ? 'bg-rose-500' : variant === 'warning' ? 'bg-amber-500' : 'bg-indigo-500'
            }`} />

            <div className="flex items-center justify-between mb-6">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                variant === 'danger' ? 'bg-rose-500/10 text-rose-500' : variant === 'warning' ? 'bg-amber-500/10 text-amber-500' : 'bg-indigo-500/10 text-indigo-500'
              }`}>
                <AlertTriangle size={24} />
              </div>
              <button 
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <h3 className="text-2xl font-black text-white mb-2">{title}</h3>
            <p className="text-slate-400 font-medium leading-relaxed mb-8">
              {message}
            </p>

            <div className="flex gap-4">
              {showCancel && (
                <button
                  onClick={onClose}
                  className="flex-1 h-14 rounded-2xl border border-slate-800 text-slate-400 font-bold hover:bg-slate-800 transition-all"
                >
                  {cancelText}
                </button>
              )}
              <button
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className={`flex-1 h-14 rounded-2xl font-black shadow-lg transition-all ${
                  variant === 'danger' 
                    ? 'bg-rose-600 text-white shadow-rose-900/40 hover:bg-rose-500' 
                    : variant === 'warning'
                    ? 'bg-amber-600 text-white shadow-amber-900/40 hover:bg-amber-500'
                    : 'bg-indigo-600 text-white shadow-indigo-900/40 hover:bg-indigo-500'
                }`}
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ConfirmModal;
