"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { TriangleAlert, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info";
type ToastOpts = { onUndo?: () => void };
type ToastItem = { id: number; msg: string; type: ToastType; onUndo?: () => void };

type ToastFn = (msg: string, type?: ToastType, opts?: ToastOpts) => void;

const ToastCtx = createContext<ToastFn>(() => {});

// Hook für beliebige Client-Komponenten: const toast = useToast(); toast("Gespeichert").
// Optionaler Rückgängig-Slot: toast("Gelöscht", "success", { onUndo: () => ... }).
export function useToast(): ToastFn {
  return useContext(ToastCtx);
}

let counter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => {
    setItems((xs) => xs.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback<ToastFn>(
    (msg, type = "success", opts) => {
      const id = ++counter;
      setItems((xs) => [...xs, { id, msg, type, onUndo: opts?.onUndo }]);
      // Toasts mit Rückgängig-Aktion bleiben etwas länger sichtbar.
      setTimeout(() => remove(id), opts?.onUndo ? 7000 : 4200);
    },
    [remove],
  );

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="toast-viewport" aria-live="polite" aria-atomic="false" role="status">
        {items.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span className="toast-icon" aria-hidden>
              {t.type === "success" ? "✓" : t.type === "error" ? <TriangleAlert size={13} /> : <Info size={13} />}
            </span>
            <span>{t.msg}</span>
            <div className="toast-actions">
              {t.onUndo ? (
                <button
                  type="button"
                  className="toast-action"
                  onClick={() => {
                    t.onUndo?.();
                    remove(t.id);
                  }}
                >
                  Rückgängig
                </button>
              ) : null}
              <button type="button" className="toast-close" aria-label="Schließen" onClick={() => remove(t.id)}>
                <X size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
