import { useState } from "react";
import StageEvals from "./StageEvals.jsx";

// One tab for the three stage exams — segmented control keeps the bottom
// nav to five items on mobile.
const STAGES = [
  { id: "uji_kampus", label: "Uji Kampus" },
  { id: "diksar", label: "Diksar" },
  { id: "diklat", label: "Diklat" },
];

export default function Tahapan(props) {
  const [stage, setStage] = useState("uji_kampus");
  return (
    <div className="space-y-4">
      <div className="bg-forest-950 rounded-md p-1 flex print:hidden">
        {STAGES.map((s) => (
          <button
            key={s.id}
            onClick={() => setStage(s.id)}
            className={`flex-1 rounded-sm py-2.5 label-mono transition-colors ${
              stage === s.id ? "bg-kuning text-forest-950" : "text-white/60 hover:text-white"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <StageEvals {...props} stage={stage} />
    </div>
  );
}
