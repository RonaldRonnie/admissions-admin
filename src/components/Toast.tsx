import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type Kind = "success" | "error";
interface Toast {
  id: number;
  kind: Kind;
  message: string;
}

const ToastContext = createContext<(kind: Kind, message: string) => void>(() => {});

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);

  const show = useCallback(
    (kind: Kind, message: string) => {
      const id = nextId++;
      // Keep the newest few: a burst of quick actions shouldn't bury the page under messages.
      setToasts((all) => [...all, { id, kind, message }].slice(-4));
      // Errors stay until dismissed: they often carry a server message worth reading in full.
      if (kind === "success") setTimeout(() => dismiss(id), 4000);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            className={`pointer-events-auto flex max-w-md items-start gap-3 rounded-md px-4 py-3 text-sm shadow-lg ${
              t.kind === "success" ? "bg-emerald-700 text-white" : "bg-red-700 text-white"
            }`}
          >
            <span className="flex-1">{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="font-semibold opacity-80 hover:opacity-100" aria-label="Dismiss">
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const show = useContext(ToastContext);
  return {
    success: (message: string) => show("success", message),
    error: (error: unknown) => show("error", error instanceof Error ? error.message : String(error)),
  };
}
