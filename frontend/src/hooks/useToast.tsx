import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { Toast } from "../components/Toast/Toast";

type ToastState = { message: string; tone: "ok" | "err" } | null;

const Ctx = createContext<(message: string, tone?: "ok" | "err") => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState>(null);

  const show = useCallback((message: string, tone: "ok" | "err" = "ok") => {
    setToast({ message, tone });
  }, []);

  const value = useMemo(() => show, [show]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {toast ? <Toast message={toast.message} tone={toast.tone} onDone={() => setToast(null)} /> : null}
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}
