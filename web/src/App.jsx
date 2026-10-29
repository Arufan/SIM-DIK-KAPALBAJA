import { useEffect, useState } from "react";
import { getAuth } from "./lib/api.js";
import { sync } from "./lib/sync.js";
import Login from "./components/Login.jsx";
import Shell from "./components/Shell.jsx";

export default function App() {
  const [profile, setProfile] = useState(() => getAuth()?.profile ?? null);

  useEffect(() => {
    if (profile) {
      sync();
      // Protect offline data: ask the browser not to evict IndexedDB under pressure.
      navigator.storage?.persist?.().catch(() => {});
      // Warm the lazy html2pdf chunk so the first PDF export never races.
      import("html2pdf.js").catch(() => {});
    }
  }, [profile]);

  if (!profile) return <Login onDone={setProfile} />;
  return <Shell profile={profile} onLogout={() => setProfile(null)} />;
}
