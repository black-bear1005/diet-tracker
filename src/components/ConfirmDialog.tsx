import React from 'react';
import { AlertCircle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'info' | 'danger' | 'warning';
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = '确定',
  cancelText = '取消',
  type = 'info'
}) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const getThemeColor = () => {
    switch (type) {
      case 'danger': return 'red';
      case 'warning': return 'orange';
      default: return 'blue';
    }
  };

  const color = getThemeColor();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 text-center">
          <div className={`mx-auto mb-4 w-12 h-12 rounded-full bg-${color}-50 flex items-center justify-center`}>
            <AlertCircle className={`text-${color}-500`} size={24} />
          </div>
          
          <h3 className="text-lg font-bold text-gray-900 mb-2">
            {title}
          </h3>
          
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            {message}
          </p>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-bold hover:bg-gray-50 transition-colors"
            >
              {cancelText}
            </button>
            <button
              onClick={handleConfirm}
              className={`flex-1 py-2.5 rounded-xl text-white font-bold shadow-lg transition-all active:scale-95 bg-${color}-500 hover:bg-${color}-600 shadow-${color}-200`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
