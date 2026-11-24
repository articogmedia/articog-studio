"use client";

import { useMemo, useState } from "react";
import templates from "@/data/templates.json";

function getPlaceholders(prompt) {
  return [...new Set(Array.from(prompt.matchAll(/\{([^}]+)\}/g), (match) => match[1]))];
}

export default function TemplatePicker({ open, onClose, onApply }) {
  const [selected, setSelected] = useState(null);
  const [values, setValues] = useState({});
  const [category, setCategory] = useState("All");
  const categories = useMemo(() => ["All", ...new Set(templates.map((item) => item.category))], []);
  const visibleTemplates = category === "All"
    ? templates
    : templates.filter((item) => item.category === category);

  if (!open) return null;

  const chooseTemplate = (template) => {
    setSelected(template);
    setValues({});
  };
  const applyTemplate = () => {
    if (!selected) return;
    const prompt = selected.prompt.replace(/\{([^}]+)\}/g, (_, key) => values[key]?.trim() || key);
    onApply({
      prompt,
      model: selected.model,
      aspect_ratio: selected.aspect_ratio,
      duration: selected.duration,
      type: selected.model === "seedance-lite-t2v" ? "video" : "image",
    });
    setSelected(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-label="Choose a template">
      <div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#111318] shadow-2xl">
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="font-semibold text-white">Prompt templates</h2>
            <p className="mt-1 text-xs text-white/50">Choose a starting point, then tailor the placeholders.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close templates" className="rounded-lg px-3 py-2 text-white/60 hover:bg-white/10 hover:text-white">Close</button>
        </header>
        <div className="flex min-h-0 flex-1">
          <section className="w-1/2 overflow-y-auto border-r border-white/10 p-4">
            <div className="mb-4 flex flex-wrap gap-2">
              {categories.map((item) => (
                <button key={item} type="button" onClick={() => setCategory(item)} className={`rounded-full px-3 py-1 text-xs ${category === item ? "bg-white text-black" : "bg-white/5 text-white/60 hover:bg-white/10"}`}>{item}</button>
              ))}
            </div>
            <div className="space-y-2">
              {visibleTemplates.map((template) => (
                <button key={template.name} type="button" onClick={() => chooseTemplate(template)} className={`w-full rounded-xl border p-3 text-left ${selected?.name === template.name ? "border-[var(--accent)] bg-white/[0.07]" : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"}`}>
                  <span className="block text-sm font-medium text-white">{template.name}</span>
                  <span className="mt-1 block text-xs text-white/45">{template.category} · {template.model}</span>
                </button>
              ))}
            </div>
          </section>
          <section className="w-1/2 overflow-y-auto p-5">
            {!selected ? (
              <p className="text-sm text-white/45">Select a template to customize it.</p>
            ) : (
              <>
                <h3 className="text-base font-semibold text-white">{selected.name}</h3>
                <p className="mt-3 text-sm leading-6 text-white/65">{selected.prompt}</p>
                <div className="mt-5 space-y-3">
                  {getPlaceholders(selected.prompt).map((key) => (
                    <label key={key} className="block text-xs capitalize text-white/60">
                      {key.replaceAll("_", " ")}
                      <input value={values[key] || ""} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))} className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/30" />
                    </label>
                  ))}
                </div>
                <p className="mt-4 text-xs text-white/45">{selected.aspect_ratio}{selected.duration ? ` · ${selected.duration}s` : ""}</p>
                <button type="button" onClick={applyTemplate} className="mt-5 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black">Use template</button>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
