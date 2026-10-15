import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);
const ICONS = { success: CheckCircle2, error: XCircle, warning: AlertTriangle, info: Info };

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback(id => setToasts(list => list.filter(t => t.id !== id)), []);

  const push = useCallback((type, message, { timeout = type === 'error' ? 8000 : 4500 } = {}) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts(list => [...list.slice(-3), { id, type, message }]);
    if (timeout) setTimeout(() => dismiss(id), timeout);
  }, [dismiss]);

  const api = useMemo(() => ({
    success: (m, o) => push('success', m, o),
    error: (m, o) => push('error', m, o),
    warning: (m, o) => push('warning', m, o),
    info: (m, o) => push('info', m, o)
  }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map(t => {
          const Icon = ICONS[t.type] || Info;
          return (
            <div key={t.id} className={`toast toast--${t.type}`}>
              <Icon size={18} className="toast__icon" />
              <span>{t.message}</span>
              <button type="button" className="toast__close" onClick={() => dismiss(t.id)} aria-label="Dismiss notification"><X size={16} /></button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
