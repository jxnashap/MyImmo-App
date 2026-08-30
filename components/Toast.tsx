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

// Eine Zeile — beide Live-Bereiche (assertive/polite) rendern dieselbe.
function ToastZeile({ t, remove }: { t: ToastItem; remove: (id: number) => void }) {
  return (
    <div className={`toast toast-${t.type}`}>
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
  );
}

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
      {/* ZWEI Bereiche, nicht einer: Fehler muessen den Screenreader
          unterbrechen (assertive), Erfolg und Hinweis duerfen warten, bis der
          Vorleser fertig ist (polite). Lagen sie zusammen in einem
          polite-Bereich, kam die Fehlermeldung unter Umstaenden erst, nachdem
          der Toast schon wieder weg war. Beide Bereiche liegen uebereinander
          im selben Streifen — optisch aendert sich nichts. */}
      <div className="toast-viewport">
        {/* Ein sichtbarer Streifen, darin ZWEI Live-Bereiche: Fehler
            unterbrechen den Screenreader (assertive), Erfolg und Hinweis
            warten, bis er ausgeredet hat (polite). Vorher lag beides in einem
            polite-Bereich — eine Fehlermeldung konnte damit erst angesagt
            werden, wenn der Toast optisch schon wieder weg war.
            Zwei eigene .toast-viewport waeren beide position:fixed gewesen und
            haetten sich uebereinandergelegt; deshalb der gemeinsame Rahmen.
            Beide Bereiche bleiben IMMER im DOM, auch leer — ein Live-Bereich,
            der erst mit seinem Inhalt entsteht, wird nicht angesagt. */}
        <div className="toast-stapel" aria-live="assertive" aria-atomic="false" role="alert">
          {items.filter((t) => t.type === "error").map((t) => (
            <ToastZeile key={t.id} t={t} remove={remove} />
          ))}
        </div>
        <div className="toast-stapel" aria-live="polite" aria-atomic="false" role="status">
          {items.filter((t) => t.type !== "error").map((t) => (
            <ToastZeile key={t.id} t={t} remove={remove} />
          ))}
        </div>
      </div>
    </ToastCtx.Provider>
  );
}
