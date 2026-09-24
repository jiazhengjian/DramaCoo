'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, CircleAlert, Info, X } from 'lucide-react';
import { Dialog } from './Overlay';

export type ToastTone = 'success' | 'error' | 'info';
export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}
interface ToastItem { id: number; message: string; tone: ToastTone }
interface PendingConfirm { options: ConfirmOptions; resolve: (accepted: boolean) => void }
interface FeedbackContextValue {
  toast: (message: string, tone?: ToastTone) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}
const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmation, setConfirmation] = useState<PendingConfirm | null>(null);
  const sequence = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const pending = useRef<PendingConfirm | null>(null);
  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setToasts(current => current.filter(item => item.id !== id));
  }, []);
  const toast = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = ++sequence.current;
    setToasts(current => [...current.slice(-3), { id, message, tone }]);
    timers.current.set(id, setTimeout(() => dismiss(id), tone === 'error' ? 8000 : 4500));
  }, [dismiss]);
  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>(resolve => {
    pending.current?.resolve(false);
    const next = { options, resolve };
    pending.current = next;
    setConfirmation(next);
  }), []);
  const settle = useCallback((accepted: boolean) => {
    const request = pending.current;
    pending.current = null;
    setConfirmation(null);
    request?.resolve(accepted);
  }, []);
  useEffect(() => {
    const activeTimers = timers.current;
    return () => {
      activeTimers.forEach(clearTimeout);
      pending.current?.resolve(false);
    };
  }, []);

  return (
    <FeedbackContext.Provider value={{ toast, confirm }}>
      {children}
      <div className="ui-toast-stack" aria-label="操作通知">
        {toasts.map(item => {
          const Icon = item.tone === 'success' ? CheckCircle2 : item.tone === 'error' ? CircleAlert : Info;
          return <div key={item.id} className={`ui-toast ui-toast-${item.tone}`} role={item.tone === 'error' ? 'alert' : 'status'}>
            <Icon size={18} aria-hidden="true" />
            <span>{item.message}</span>
            <button type="button" className="ui-icon-button" onClick={() => dismiss(item.id)} aria-label="关闭通知"><X size={16} /></button>
          </div>;
        })}
      </div>
      <Dialog open={Boolean(confirmation)} onClose={() => settle(false)} title={confirmation?.options.title || '请确认'} footer={<>
        <button type="button" className="ui-button" onClick={() => settle(false)}>{confirmation?.options.cancelLabel || '取消'}</button>
        <button type="button" className={`ui-button ${confirmation?.options.danger ? 'ui-button-danger' : 'ui-button-primary'}`} onClick={() => settle(true)}>{confirmation?.options.confirmLabel || '确认'}</button>
      </>}>
        <p className="text-sm leading-6 text-muted">{confirmation?.options.description || '确认继续此操作？'}</p>
      </Dialog>
    </FeedbackContext.Provider>
  );
}

export function useToast() {
  const context = useContext(FeedbackContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context.toast;
}

export function useConfirm() {
  const context = useContext(FeedbackContext);
  if (!context) throw new Error('useConfirm must be used within ToastProvider');
  return context.confirm;
}
