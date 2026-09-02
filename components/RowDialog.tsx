"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useModalFokus } from "@/lib/modalFokus";

// Wiederverwendbarer Bearbeiten-Dialog (Modal) im einheitlichen App-Stil.
// Rendert per Portal an <body> (valides DOM auch aus Tabellen heraus).
// Schließt per ESC, Klick aufs Overlay oder X.
//
// Fokus (Anfangsfokus, Falle, Rückgabe) und das Stummschalten des Hintergrunds
// für Screenreader kommen aus `useModalFokus` — siehe dort, warum jedes der drei
// Teile nötig ist.
export default function RowDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // `mounted` als Aktiv-Flag: vor dem Portal-Mount ist die Ref leer.
  const ref = useModalFokus<HTMLDivElement>(onClose, mounted);

  if (!mounted) return null;

  return createPortal(
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* role/aria-modal sitzen auf dem Blatt, nicht auf dem Overlay: sonst
          zählt der Hintergrund-Schleier mit zum Dialog. tabIndex={-1}, damit
          der Dialog den Anfangsfokus annehmen kann, wenn er kein Bedienelement
          enthält. */}
      <div
        ref={ref}
        className="modal-sheet wide"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h3 style={{ fontSize: 17 }}>{title}</h3>
          <button type="button" className="icon-btn" onClick={onClose} title="Schließen" aria-label="Schließen">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
