'use client';

import { useEffect, useId, useRef, useSyncExternalStore, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;
const layers: string[] = [];
let bodyLocks = 0;
let previousOverflow = '';
const focusableSelector = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusableWithin(element: HTMLElement) {
  return Array.from(element.querySelectorAll<HTMLElement>(focusableSelector)).filter(node => node.getClientRects().length > 0 && !node.closest('[inert]'));
}

function lockBody() {
  if (bodyLocks++ === 0) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  return () => {
    if (--bodyLocks === 0) document.body.style.overflow = previousOverflow;
  };
}

function removeLayer(id: string) {
  const index = layers.lastIndexOf(id);
  if (index >= 0) layers.splice(index, 1);
}

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function Dialog({ open, onClose, title, description, children, footer, className = '' }: DialogProps) {
  const ready = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!open || !ready || !panel.current) return;
    const element = panel.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    layers.push(id);
    if (element.parentElement) element.parentElement.style.zIndex = String(100 + layers.length * 10);
    const unlock = lockBody();
    const header = element.querySelector<HTMLElement>('.ui-dialog-header');
    const footer = element.querySelector<HTMLElement>('.ui-dialog-footer');
    const updateInsets = () => {
      element.style.setProperty('--dialog-header-height', `${header?.offsetHeight || 0}px`);
      element.style.setProperty('--dialog-footer-height', `${footer?.offsetHeight || 0}px`);
    };
    updateInsets();
    const observer = new ResizeObserver(updateInsets);
    if (header) observer.observe(header);
    if (footer) observer.observe(footer);
    const focusFirst = () => (focusableWithin(element)[0] || element).focus();
    focusFirst();
    const keydown = (event: KeyboardEvent) => {
      if (layers.at(-1) !== id) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        close.current();
      } else if (event.key === 'Tab') {
        const nodes = focusableWithin(element);
        const first = nodes[0];
        const last = nodes.at(-1);
        if (!first || !last) {
          event.preventDefault();
          element.focus();
        } else if (event.shiftKey && (document.activeElement === first || document.activeElement === element)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    const focusin = (event: FocusEvent) => {
      if (layers.at(-1) === id && !element.contains(event.target as Node)) focusFirst();
    };
    document.addEventListener('keydown', keydown);
    document.addEventListener('focusin', focusin);
    return () => {
      removeLayer(id);
      observer.disconnect();
      unlock();
      document.removeEventListener('keydown', keydown);
      document.removeEventListener('focusin', focusin);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [id, open, ready]);

  if (!open || !ready) return null;
  return createPortal(
    <div className="ui-dialog-backdrop" onPointerDown={event => {
      if (event.target === event.currentTarget && layers.at(-1) === id) onClose();
    }}>
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={description ? `${id}-description` : undefined} tabIndex={-1} className={`ui-dialog ${className}`}>
        <header className="ui-dialog-header">
          <div className="min-w-0">
            <h2 id={`${id}-title`}>{title}</h2>
            {description && <p id={`${id}-description`}>{description}</p>}
          </div>
          <button type="button" className="ui-icon-button" onClick={onClose} aria-label="关闭对话框"><X size={18} /></button>
        </header>
        <div className="ui-dialog-body">{children}</div>
        {footer && <footer className="ui-dialog-footer">{footer}</footer>}
      </div>
    </div>, document.body,
  );
}

export interface PopoverProps {
  open: boolean;
  onClose: () => void;
  triggerRef: RefObject<HTMLElement | null>;
  children: ReactNode;
  align?: 'start' | 'end';
  className?: string;
  label?: string;
}

export function Popover({ open, onClose, triggerRef, children, align = 'start', className = '', label = '更多选项' }: PopoverProps) {
  const ready = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!open || !ready || !panel.current || !triggerRef.current) return;
    const element = panel.current;
    const trigger = triggerRef.current;
    layers.push(id);
    element.style.zIndex = String(100 + layers.length * 10);
    const position = () => {
      const anchor = trigger.getBoundingClientRect();
      const gap = 8;
      const margin = 12;
      const width = document.documentElement.clientWidth;
      const height = window.innerHeight;
      element.style.maxWidth = `${Math.max(0, width - margin * 2)}px`;
      const below = height - anchor.bottom - gap - margin;
      const above = anchor.top - gap - margin;
      const useAbove = element.scrollHeight > below && above > below;
      element.style.maxHeight = `${Math.max(48, useAbove ? above : below)}px`;
      const bounds = element.getBoundingClientRect();
      const left = align === 'end' ? anchor.right - bounds.width : anchor.left;
      const top = useAbove ? anchor.top - gap - bounds.height : anchor.bottom + gap;
      element.style.left = `${Math.max(margin, Math.min(left, width - bounds.width - margin))}px`;
      element.style.top = `${Math.max(margin, Math.min(top, height - bounds.height - margin))}px`;
      element.style.opacity = '1';
    };
    position();
    (focusableWithin(element)[0] || element).focus({ preventScroll: true });
    const pointerdown = (event: PointerEvent) => {
      if (layers.at(-1) === id && !element.contains(event.target as Node) && !trigger.contains(event.target as Node)) close.current();
    };
    const keydown = (event: KeyboardEvent) => {
      if (layers.at(-1) !== id) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        close.current();
      } else if (event.key === 'Tab') {
        const nodes = focusableWithin(element);
        if (!nodes.length || (event.shiftKey ? document.activeElement === nodes[0] : document.activeElement === nodes.at(-1))) {
          event.preventDefault();
          close.current();
        }
      }
    };
    const observer = new ResizeObserver(position);
    observer.observe(element);
    observer.observe(trigger);
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    document.addEventListener('pointerdown', pointerdown);
    document.addEventListener('keydown', keydown);
    return () => {
      removeLayer(id);
      observer.disconnect();
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
      document.removeEventListener('pointerdown', pointerdown);
      document.removeEventListener('keydown', keydown);
      if (trigger.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [align, id, open, ready, triggerRef]);

  if (!open || !ready) return null;
  return createPortal(
    <div ref={panel} role="dialog" aria-label={label} tabIndex={-1} className={`ui-popover ${className}`} style={{ position: 'fixed', opacity: 0, overflowY: 'auto' }}>{children}</div>,
    document.body,
  );
}
