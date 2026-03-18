"use client";

import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import ReactMarkdown from "react-markdown";
import { Loader2, Plus, FileText, Send } from "lucide-react";

export default function Home() {
  const [sources, setSources] = useState([{ id: uuidv4(), title: "", content: "" }]);
  const [note, setNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddSource = () => {
    setSources([...sources, { id: uuidv4(), title: "", content: "" }]);
  };

  const updateSource = (index: number, field: "title" | "content", value: string) => {
    const newSources = [...sources];
    newSources[index][field] = value;
    setSources(newSources);
  };

  const handleRemoveSource = (index: number) => {
    setSources(sources.filter((_, i) => i !== index));
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setNote(null);
    
    // Filter out completely empty sources
    const validSources = sources.filter((s) => s.title.trim() || s.content.trim());

    if (validSources.length === 0) {
      setError("Please add at least one source before generating.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sources: validSources.map(({ title, content }) => ({ title, content })) }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate note");
      }

      if (data.markdown) {
        setNote(data.markdown);
      } else if (data.error) {
        throw new Error(data.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-neutral-900 text-neutral-100 font-sans">
      {/* Sidebar: Sources Input */}
      <div className="w-1/3 min-w-[350px] border-r border-neutral-800 bg-neutral-950 p-6 flex flex-col overflow-y-auto">
        <div className="flex items-center gap-2 mb-8">
          <FileText className="text-blue-500" />
          <h1 className="text-xl font-bold tracking-tight">NotetakingApp</h1>
        </div>

        <p className="text-sm text-neutral-400 mb-6 leading-relaxed">
          Upload your transcripts, handwritten OCR, or textbook snippets below. Our AI will synthesize them into a professional study guide.
        </p>

        <div className="flex flex-col gap-6 flex-1">
          {sources.map((source, index) => (
            <div key={source.id} className="flex flex-col gap-3 p-4 bg-neutral-900 rounded-xl border border-neutral-800 shadow-sm focus-within:border-blue-500/50 transition-colors">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder={`Source ${index + 1} Title`}
                  value={source.title}
                  onChange={(e) => updateSource(index, "title", e.target.value)}
                  className="bg-transparent border-b border-neutral-800 pb-2 text-sm font-medium focus:outline-none focus:border-blue-500 transition-colors placeholder:text-neutral-600 flex-1"
                />
                {sources.length > 1 && (
                  <button
                    onClick={() => handleRemoveSource(index)}
                    className="mb-2 text-neutral-600 hover:text-red-400 transition-colors text-xs"
                    aria-label="Remove source"
                  >
                    ✕
                  </button>
                )}
              </div>
              <textarea
                placeholder="Paste transcript or notes here..."
                value={source.content}
                onChange={(e) => updateSource(index, "content", e.target.value)}
                className="bg-transparent resize-none h-32 text-sm focus:outline-none placeholder:text-neutral-600 leading-relaxed custom-scrollbar"
              />
            </div>
          ))}

          <button
            onClick={handleAddSource}
            className="flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-neutral-700 text-neutral-400 hover:text-neutral-200 hover:border-neutral-500 hover:bg-neutral-800/50 transition-all text-sm font-medium"
          >
            <Plus size={16} /> Add Another Source
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-neutral-800 sticky bottom-0 bg-neutral-950 pb-2">
          {error && <div className="text-red-400 text-sm mb-4 px-2 py-1 bg-red-950/30 rounded border border-red-900/50">{error}</div>}
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(37,99,235,0.15)] hover:shadow-[0_0_25px_rgba(37,99,235,0.25)]"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
            {loading ? "Synthesizing Notes..." : "Generate Professional Note"}
          </button>
        </div>
      </div>

      {/* Main Content: Rendered Output */}
      <div className="flex-1 bg-neutral-900 flex flex-col items-center overflow-y-auto">
        {note ? (
          <div className="w-full max-w-4xl py-12 px-8 flex-1">
            <div className="prose prose-invert prose-blue max-w-none prose-headings:font-bold prose-h1:text-3xl prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4 prose-p:text-neutral-300 prose-p:leading-relaxed prose-li:text-neutral-300 prose-strong:text-white prose-hr:border-neutral-800 bg-neutral-950/50 rounded-2xl p-10 border border-neutral-800 shadow-xl">
              <ReactMarkdown>{note}</ReactMarkdown>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-neutral-500 px-8 text-center max-w-md">
            <div className="w-16 h-16 bg-neutral-800 rounded-2xl flex items-center justify-center mb-6 shadow-inner border border-neutral-700">
              <FileText size={24} className="text-neutral-400" />
            </div>
            <h2 className="text-xl font-medium text-neutral-300 mb-2">NotebookLM-Style Synthesis</h2>
            <p className="text-sm leading-relaxed">
              Paste your raw context on the left. We'll run it through the Layer 3 AI engine and render a beautifully formatted Markdown study guide right here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
