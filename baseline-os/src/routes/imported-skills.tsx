import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { importedSkillsByCategory, IMPORTED_SKILLS_COUNT } from "@/lib/imported-skills";

export const Route = createFileRoute("/imported-skills")({
  head: () => ({
    meta: [
      { title: "Imported Skills — Baseline Automations" },
      {
        name: "description",
        content:
          "Skills distilled from audited sources (NotebookLM, Presentation Builder, YouTube, Publish-to-GitHub/Vercel, Morning Brief, Business Insight, Memory System, Pinecone 2.0).",
      },
    ],
  }),
  component: ImportedSkillsPage,
});

function ImportedSkillsPage() {
  const byCategory = useMemo(() => importedSkillsByCategory(), []);
  const categories = useMemo(
    () => Object.entries(byCategory).filter(([, v]) => v.length > 0),
    [byCategory],
  );

  return (
    <div
      className="min-h-screen bg-[#09090D] text-white p-6 max-w-6xl mx-auto"
      data-testid="imported-skills"
    >
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.01] p-6 mb-6">
        <h1 className="text-2xl font-bold">Imported Skills · {IMPORTED_SKILLS_COUNT}</h1>
        <p className="text-sm text-gray-400 mt-1 max-w-3xl">
          Skills distilled and classified from the audited source folders/files — NotebookLM,
          Presentation Builder, YouTube, Publish-to-GitHub/Vercel, Morning Brief, Business Insight,
          Memory System OS, and Pinecone 2.0. Credentialed skills stay setup-needed until connected.
        </p>
      </div>

      <div className="space-y-5">
        {categories.map(([cat, skills]) => (
          <div key={cat}>
            <h2 className="text-xs uppercase tracking-wide text-gray-500 mb-2">
              {cat} · {skills.length}
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {skills.map((s) => (
                <div
                  key={s.slug}
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.01] p-4"
                  data-testid={`imported-skill-${s.slug}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{s.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-300">
                      {s.pricing === "free" ? "Free" : `$${s.priceUsd}`}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{s.summary}</p>
                  <p className="text-[10px] text-gray-600 mt-1">
                    Wires into: {s.wiresInto.join(", ")}
                  </p>
                  <p className="text-[10px] text-gray-600 mt-0.5">Proof: {s.proofExpectations}</p>
                  {s.requiredCredentials.length > 0 && (
                    <p
                      className="text-[10px] text-amber-400 mt-1"
                      data-testid={`imported-setup-${s.slug}`}
                    >
                      Setup needed: {s.requiredCredentials.join(", ")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
