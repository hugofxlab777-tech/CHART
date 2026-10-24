/**
 * Shared UI primitives: toast notifications, an async confirmation dialog
 * and a small modal manager (ESC close, focus trap, focus restore).
 */

export type ToastType = 'success' | 'error' | 'info';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement
  );
}

export class Toast {
  private static container: HTMLElement | null = null;

  private static ensureContainer(): HTMLElement {
    if (!this.container || !this.container.isConnected) {
      this.container = document.createElement('div');
      this.container.className = 'toast-container';
      this.container.setAttribute('aria-live', 'polite');
      document.body.appendChild(this.container);
    }
    return this.container;
  }

  public static show(message: string, type: ToastType = 'info', duration = 2600): void {
    const host = this.ensureContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'status');
    const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
    toast.innerHTML = `<span class="toast-icon" aria-hidden="true">${icon}</span><span class="toast-message"></span>`;
    (toast.querySelector('.toast-message') as HTMLElement).innerText = message;
    host.appendChild(toast);

    window.setTimeout(() => {
      toast.classList.add('toast-leaving');
      window.setTimeout(() => toast.remove(), 250);
    }, duration);
  }
}

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay hidden';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = `
      <div class="modal-card modal-confirm">
        <div class="modal-header">
          <h3></h3>
        </div>
        <div class="modal-body"><p></p></div>
        <div class="modal-footer">
          <button class="btn-action btn-secondary" data-confirm-cancel></button>
          <button class="btn-action" data-confirm-ok></button>
        </div>
      </div>
    `;
    (overlay.querySelector('h3') as HTMLElement).innerText = opts.title || 'Patvirtinimas';
    (overlay.querySelector('.modal-body p') as HTMLElement).innerText = opts.message;
    const okBtn = overlay.querySelector('[data-confirm-ok]') as HTMLButtonElement;
    const cancelBtn = overlay.querySelector('[data-confirm-cancel]') as HTMLButtonElement;
    okBtn.innerText = opts.confirmLabel || 'Patvirtinti';
    cancelBtn.innerText = opts.cancelLabel || 'Atšaukti';
    if (opts.danger) okBtn.classList.add('btn-take');
    else okBtn.classList.add('btn-gold');

    document.body.appendChild(overlay);

    let settled = false;
    const settle = (result: boolean) => {
      if (settled) return;
      settled = true;
      ModalManager.close(overlay);
      overlay.remove();
      resolve(result);
    };

    okBtn.addEventListener('click', () => settle(true));
    cancelBtn.addEventListener('click', () => settle(false));
    ModalManager.open(overlay, { onClose: () => settle(false) });
  });
}

interface ModalEntry {
  el: HTMLElement;
  restoreFocus: HTMLElement | null;
  onClose?: () => void;
}

export class ModalManager {
  private static stack: ModalEntry[] = [];
  private static initialized = false;

  public static init(): void {
    if (this.initialized) return;
    this.initialized = true;

    window.addEventListener('keydown', (e) => {
      if (this.stack.length === 0) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        const top = this.stack[this.stack.length - 1];
        this.close(top.el);
      } else if (e.key === 'Tab') {
        this.trapFocus(e);
      }
    });
  }

  public static open(el: HTMLElement, opts: { onClose?: () => void } = {}): void {
    this.init();
    if (this.stack.some((entry) => entry.el === el)) return;

    this.stack.push({ el, restoreFocus: document.activeElement as HTMLElement | null, onClose: opts.onClose });
    el.classList.remove('hidden');
    document.body.classList.add('modal-open');

    // Backdrop click closes (unless the modal opts out via data-no-backdrop-close)
    if (!el.hasAttribute('data-no-backdrop-close')) {
      el.addEventListener('click', this.backdropHandler);
    }

    const focusable = getFocusable(el);
    (focusable[0] || el).focus({ preventScroll: true });
  }

  public static close(el: HTMLElement): void {
    const idx = this.stack.findIndex((entry) => entry.el === el);
    if (idx === -1) {
      el.classList.add('hidden');
      return;
    }

    const [entry] = this.stack.splice(idx, 1);
    el.removeEventListener('click', this.backdropHandler);
    el.classList.add('hidden');
    if (this.stack.length === 0) document.body.classList.remove('modal-open');
    entry.restoreFocus?.focus({ preventScroll: true });
    entry.onClose?.();
  }

  public static isOpen(el: HTMLElement): boolean {
    return this.stack.some((entry) => entry.el === el && !el.classList.contains('hidden'));
  }

  private static backdropHandler = (e: Event): void => {
    if (e.target instanceof HTMLElement && e.target.classList.contains('modal-overlay')) {
      ModalManager.close(e.target);
    }
  };

  private static trapFocus(e: KeyboardEvent): void {
    const top = this.stack[this.stack.length - 1];
    if (!top) return;
    const focusable = getFocusable(top.el);
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement as HTMLElement | null;

    if (e.shiftKey && (active === first || !top.el.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !top.el.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  }
}
