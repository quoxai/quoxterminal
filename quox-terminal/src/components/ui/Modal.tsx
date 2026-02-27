/**
 * Modal — Lightweight modal replacement for Quox's Modal component.
 */

import { useEffect, useCallback, type ReactNode } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  severity?: "info" | "warning" | "danger";
  className?: string;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  severity = "info",
  className = "",
}: ModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div className={`modal-overlay ${className}`} onClick={onClose}>
      <div
        className={`modal-content modal-content--${severity}`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && <h3 className="modal-title">{title}</h3>}
        {children}
      </div>
    </div>
  );
}
