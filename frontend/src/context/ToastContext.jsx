import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CircleCheck, CircleX, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const STYLES = {
  success: { Icon: CircleCheck, color: 'text-emerald-500' },
  error: { Icon: CircleX, color: 'text-rose-500' },
  info: { Icon: Info, color: 'text-indigo-500' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id) => setToasts((all) => all.filter((t) => t.id !== id)), []);

  const toast = useMemo(() => {
    const push = (type) => (message) => {
      const id = ++nextId.current;
      setToasts((all) => [...all.slice(-3), { id, type, message }]);
      setTimeout(() => dismiss(id), type === 'error' ? 6000 : 3500);
    };
    return { success: push('success'), error: push('error'), info: push('info') };
  }, [dismiss]);

  return (
    <ToastContext value={toast}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:items-end"
      >
        {toasts.map(({ id, type, message }) => {
          const { Icon, color } = STYLES[type];
          return (
            <div
              key={id}
              role="status"
              className="animate-toast-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-lg shadow-slate-900/5"
            >
              <Icon className={`mt-0.5 size-5 shrink-0 ${color}`} />
              <p className="flex-1 text-sm text-slate-700">{message}</p>
              <button onClick={() => dismiss(id)} className="text-slate-400 hover:text-slate-600" aria-label="Dismiss">
                <X className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext>
  );
}

export const useToast = () => useContext(ToastContext);
