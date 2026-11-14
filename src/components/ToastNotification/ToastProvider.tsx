'use client';

import * as Toast from '@radix-ui/react-toast';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useState,
} from 'react';
import styles from './ToastNotification.module.css';

export interface ToastAction {
  label: string;
  /** Opens in a new tab. Use onClick for in-app actions. */
  href?: string;
  onClick?: () => void;
}

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: 'success' | 'error' | 'info';
  /** Links or buttons shown under the message. */
  actions?: ToastAction[];
  /**
   * Milliseconds before auto-dismiss (default 5000, or 10000 when there are
   * actions or the variant is 'error'). Pass 0 to keep it until dismissed.
   * The timer pauses while the toast is hovered or focused.
   */
  duration?: number;
  /** Showing a toast with the same key replaces the existing one instead of stacking. */
  key?: string;
}

interface ToastMessage extends ToastOptions {
  id: string;
}

interface ToastContextValue {
  showToast: (message: ToastOptions) => void;
}

const MAX_VISIBLE_TOASTS = 3;
const DEFAULT_DURATION_MS = 5000;
const LONG_DURATION_MS = 10000;

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: ToastOptions) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) =>
      [
        ...prev.filter((toast) => !message.key || toast.key !== message.key),
        { ...message, id },
      ].slice(-MAX_VISIBLE_TOASTS),
    );
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      <Toast.Provider swipeDirection="right">
        {children}
        {toasts.map((toast) => (
          <Toast.Root
            key={toast.id}
            className={`${styles.root} ${toast.variant ? styles[toast.variant] : ''}`}
            type={toast.variant === 'error' ? 'foreground' : 'background'}
            duration={
              toast.duration === 0
                ? Number.POSITIVE_INFINITY
                : (toast.duration ??
                  (toast.actions?.length || toast.variant === 'error'
                    ? LONG_DURATION_MS
                    : DEFAULT_DURATION_MS))
            }
            onOpenChange={(open) => {
              if (!open) dismiss(toast.id);
            }}
          >
            <Toast.Title className={styles.title}>{toast.title}</Toast.Title>
            {toast.description && (
              <Toast.Description className={styles.description}>
                {toast.description}
              </Toast.Description>
            )}
            {toast.actions && toast.actions.length > 0 && (
              <div className={styles.actions}>
                {toast.actions.map((action) => (
                  <Toast.Action
                    key={action.label}
                    altText={action.label}
                    asChild
                  >
                    {action.href ? (
                      <a
                        className={styles.action}
                        href={action.href}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {action.label}
                      </a>
                    ) : (
                      <button
                        type="button"
                        className={styles.action}
                        onClick={action.onClick}
                      >
                        {action.label}
                      </button>
                    )}
                  </Toast.Action>
                ))}
              </div>
            )}
            <Toast.Close className={styles.close}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </Toast.Close>
          </Toast.Root>
        ))}
        <Toast.Viewport className={styles.viewport} />
      </Toast.Provider>
    </ToastContext.Provider>
  );
}
