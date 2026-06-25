"use client";

import { createContext, useCallback, useContext, useState } from "react";

type ToastType = "success" | "error" | "info";
type ToastItem = { id: number; msg: string; type: ToastType };

type ToastFn = (msg: string, type?: ToastType) => void;

const ToastCtx = createContext<ToastFn>(() => {});

// Hook für beliebige Client-Komponenten: const toast = useToast(); toast("Gespeichert").
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
    (msg, type = "success") => {
      const id = ++counter;
      setItems((xs) => [...xs, { id, msg, type }]);
      setTimeout(() => remove(id), 4200);
    },
    [remove],
  );

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="toast-viewport" aria-live="polite" aria-atomic="false">
        {items.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`toast toast-${t.type}`}
            onClick={() => remove(t.id)}
            title="Schließen"
          >
            <span className="toast-icon" aria-hidden>
              {t.type === "success" ? "✓" : t.type === "error" ? "⚠" : "ℹ"}
            </span>
            <span>{t.msg}</span>
          </button>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
