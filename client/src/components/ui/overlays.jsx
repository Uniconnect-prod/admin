import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

function useEscape(open, onClose) {
  useEffect(() => {
    if (!open) return undefined;
    const handler = e => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);
}

function useFocusOnOpen(open, ref) {
  useEffect(() => {
    if (!open) return undefined;
    const previously = document.activeElement;
    const node = ref.current;
    const focusable = node?.querySelector('input, select, textarea, button:not([data-close])');
    (focusable || node)?.focus?.();
    return () => previously?.focus?.();
  }, [open, ref]);
}

export const Modal = ({ open, title, subtitle, onClose, footer, size = 'md', children }) => {
  const ref = useRef(null);
  useEscape(open, onClose);
  useFocusOnOpen(open, ref);
  if (!open) return null;
  return createPortal(
    <div className="overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className={`modal ${size === 'lg' ? 'modal--lg' : ''}`} role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1}>
        <div className="modal__header">
          <div>
            <h2 className="modal__title">{title}</h2>
            {subtitle && <p className="modal__subtitle">{subtitle}</p>}
          </div>
          <button type="button" className="btn btn--ghost btn--icon btn--sm" onClick={onClose} aria-label="Close" data-close><X size={18} /></button>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__footer">{footer}</div>}
      </div>
    </div>,
    document.body
  );
};

export const Drawer = ({ open, title, subtitle, onClose, children }) => {
  const ref = useRef(null);
  useEscape(open, onClose);
  useFocusOnOpen(open, ref);
  if (!open) return null;
  return createPortal(
    <div className="drawer-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose?.(); }}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1}>
        <div className="drawer__header">
          <div>
            <h2 className="modal__title">{title}</h2>
            {subtitle && <p className="modal__subtitle">{subtitle}</p>}
          </div>
          <button type="button" className="btn btn--ghost btn--icon btn--sm" onClick={onClose} aria-label="Close" data-close><X size={18} /></button>
        </div>
        <div className="drawer__body">{children}</div>
      </aside>
    </div>,
    document.body
  );
};

export const ConfirmDialog = ({ open, title, message, confirmLabel = 'Confirm', tone = 'primary', busy = false, onConfirm, onClose }) => (
  <Modal
    open={open}
    title={title}
    onClose={busy ? undefined : onClose}
    footer={(
      <>
        <button type="button" className="btn btn--secondary" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className={`btn btn--${tone}`} onClick={onConfirm} disabled={busy}>{busy ? 'Working…' : confirmLabel}</button>
      </>
    )}
  >
    <p>{message}</p>
  </Modal>
);

/**
 * Click-outside dropdown container. children receives a close() callback.
 */
export const Dropdown = ({ trigger, children, align = 'left', className = '' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = e => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = e => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div className={`dropdown ${className}`} ref={ref}>
      {trigger({ open, toggle: () => setOpen(o => !o) })}
      {open && (
        <div className="menu" style={align === 'right' ? { right: 0 } : { left: 0 }} role="menu">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
};
