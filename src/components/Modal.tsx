import { useEffect, type ReactNode } from "react";
import { IconClose } from "./Icons";

interface ModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}

export default function Modal({ open, title, subtitle, onClose, children, wide }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.classList.add("modal-open");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("modal-open");
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onMouseDown={onClose} role="presentation">
      <div
        className={`max-w-2xl w-full bg-surface border border-line rounded-lg shadow-xl overflow-hidden flex flex-col ${wide ? "max-w-4xl" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="px-6 py-4 border-b border-line flex items-center justify-between">
          <div>
            <h2 className="text-xl font-serif font-medium text-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
          </div>
          <button className="p-1 hover:bg-surface-2 rounded-sm text-muted hover:text-accent" onClick={onClose} aria-label="Close dialog">
            <IconClose size={18} />
          </button>
        </header>
        <div className="p-6 overflow-y-auto max-h-[80vh]">{children}</div>
      </div>
    </div>
  );
}
