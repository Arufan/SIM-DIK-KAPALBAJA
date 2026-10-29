// Minimal event-based toasts — no extra dependency.
export function showToast(message, kind = "ok") {
  window.dispatchEvent(new CustomEvent("simdik-toast", { detail: { message, kind, id: crypto.randomUUID() } }));
}

import { useEffect, useState } from "react";

export function ToastHost() {
  const [toasts, setToasts] = useState([]);
  useEffect(() => {
    const on = (e) => {
      const t = e.detail;
      setToasts((prev) => [...prev, t]);
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 3200);
    };
    window.addEventListener("simdik-toast", on);
    return () => window.removeEventListener("simdik-toast", on);
  }, []);
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 print:hidden">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg ${
            t.kind === "error" ? "bg-red-600 text-white" : "bg-forest-950 text-white border-l-2 border-kuning"
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
