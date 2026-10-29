import { useEffect, useState } from "react";
import { getAuth } from "./lib/api.js";
import { sync } from "./lib/sync.js";
import Login from "./components/Login.jsx";
import Shell from "./components/Shell.jsx";

export default function App() {
  const [profile, setProfile] = useState(() => getAuth()?.profile ?? null);

  useEffect(() => {
    if (profile) sync();
  }, [profile]);

  if (!profile) return <Login onDone={setProfile} />;
  return <Shell profile={profile} onLogout={() => setProfile(null)} />;
}
