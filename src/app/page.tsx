"use client";

import { useState, useEffect, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { Loader2, Plus, FileText, Send, LogOut, ChevronDown, ChevronRight, Clock, PenLine, Trash2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";
import { useAutoSave } from "@/hooks/useAutoSave";
import NoteEditor from "@/components/NoteEditor";

export default function Home() {
  const { user, signOut } = useAuth();
  const [sources, setSources] = useState([{ id: uuidv4(), title: "", content: "", type: "transcript" }]);
  const [note, setNote] = useState<string | null>(null);
  const [noteId, setNoteId] = useState<string | null>(null);
  const [noteTitle, setNoteTitle] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<{ id: string; title: string; created_at: string }[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<"sources" | "note">("sources");

  const { status: saveStatus } = useAutoSave(noteId, note ?? "", 1000);

  const handleNewNote = () => {
    setNote(null);
    setNoteId(null);
    setNoteTitle("");
    setError(null);
    setSources([{ id: uuidv4(), title: "", content: "", type: "transcript" }]);
  };

  const handleDeleteNote = async (id: string) => {
    await supabase.from("notes").delete().eq("id", id);
    await fetchHistory();
    if (noteId === id) {
      setNote(null);
      setNoteId(null);
      setNoteTitle("");
    }
  };

  const handleAddSource = () => {
    setSources([...sources, { id: uuidv4(), title: "", content: "", type: "transcript" }]);
  };

  const updateSource = (index: number, field: "title" | "content" | "type", value: string) => {
    const newSources = [...sources];
    newSources[index][field] = value;
    setSources(newSources);
  };

  const handleRemoveSource = (index: number) => {
    setSources(sources.filter((_, i) => i !== index));
  };

  const fetchHistory = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notes")
      .select("id, title, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setHistory(data);
  }, [user]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    if (!noteId || !noteTitle.trim()) return;
    const timer = setTimeout(async () => {
      await supabase.from("notes").update({ title: noteTitle }).eq("id", noteId);
      await fetchHistory();
    }, 1000);
    return () => clearTimeout(timer);
  }, [noteTitle, noteId, fetchHistory]);

  const loadNote = async (id: string) => {
    const { data } = await supabase
      .from("notes")
      .select("content, title")
      .eq("id", id)
      .single();
    if (data) {
      setNote(data.content);
      setNoteId(id);
      if (data.title) setNoteTitle(data.title);
    }
  };

  const saveToSupabase = async (markdown: string, validSources: typeof sources) => {
    if (!user) return;
    setSaving(true);
    try {
      const { data: savedSources, error: sourcesError } = await supabase
        .from("sources")
        .insert(validSources.map((s) => ({
          user_id: user.id,
          title: s.title || "Untitled Source",
          content: s.content,
          type: s.type,
        })))
        .select("id");

      if (sourcesError) throw sourcesError;

      const sourceIds = (savedSources ?? []).map((s: { id: string }) => s.id);
      const firstHeading = markdown.match(/^#\s+(.+)$/m)?.[1] ?? "Untitled Note";

      const { data: noteData, error: noteError } = await supabase.from("notes").insert({
        user_id: user.id,
        title: firstHeading,
        content: markdown,
        source_ids: sourceIds,
        is_ai_generated: true,
        last_autosaved: new Date().toISOString(),
      }).select("id").single();

      if (noteError) throw noteError;
      if (noteData) setNoteId(noteData.id);
      setNoteTitle(firstHeading);
      await fetchHistory();
    } catch (e) {
      console.error("Failed to save to Supabase:", e);
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setNote(null);

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
      if (!res.ok) throw new Error(data.error || "Failed to generate note");

      if (data.markdown) {
        setNote(data.markdown);
        setMobileTab("note");
        await saveToSupabase(data.markdown, validSources);
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
    <div className="flex flex-col h-screen w-full bg-gray-50 text-gray-900 font-sans md:flex-row">
      {/* Mobile tab bar */}
      <div className="flex md:hidden border-b border-gray-200 bg-white flex-shrink-0">
        <button
          onClick={() => setMobileTab("sources")}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${mobileTab === "sources" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-400"}`}
        >
          Sources
        </button>
        <button
          onClick={() => setMobileTab("note")}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${mobileTab === "note" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-400"}`}
        >
          Note
        </button>
      </div>

      {/* Sidebar: Sources Input */}
      <div className={`w-full md:w-1/3 md:min-w-[350px] border-r border-gray-200 bg-white p-6 flex flex-col overflow-y-auto ${mobileTab === "sources" ? "flex" : "hidden"} md:flex`}>
        <div className="flex items-center gap-2 mb-8">
          <FileText className="text-gray-600" />
          <h1 className="text-xl font-bold tracking-tight flex-1">Synapse</h1>
          <button onClick={handleNewNote} title="New note" className="text-gray-400 hover:text-gray-700 transition-colors">
            <PenLine size={16} />
          </button>
          <button
            onClick={signOut}
            title="Sign out"
            className="text-gray-400 hover:text-gray-700 transition-colors"
          >
            <LogOut size={16} />
          </button>
        </div>
        {user && (
          <p className="text-xs text-gray-400 -mt-6 mb-4 truncate">{user.email}</p>
        )}

        {/* Note History */}
        {history.length > 0 && (
          <div className="mb-6">
            <button
              onClick={() => setHistoryOpen((o) => !o)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors w-full mb-2"
            >
              {historyOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              <Clock size={12} />
              Past Notes ({history.length})
            </button>
            {historyOpen && (
              <div className="flex flex-col gap-0.5">
                {history.map((n) => (
                  <div key={n.id} className="relative group">
                    <button
                      onClick={() => loadNote(n.id)}
                      className="text-left px-3 py-2 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-colors w-full"
                    >
                      <p className="text-xs text-gray-700 truncate pr-6">{n.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{new Date(n.created_at).toLocaleDateString()}</p>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteNote(n.id); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                      title="Delete note"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          Upload your transcripts, handwritten OCR, or textbook snippets below. Our AI will synthesize them into a professional study guide.
        </p>

        <div className="flex flex-col gap-4 flex-1">
          {sources.map((source, index) => (
            <div key={source.id} className="flex flex-col gap-3 p-4 bg-white rounded-xl border border-gray-200 shadow-sm focus-within:border-blue-400/60 transition-colors">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder={`Source ${index + 1} Title`}
                  value={source.title}
                  onChange={(e) => updateSource(index, "title", e.target.value)}
                  className="bg-transparent border-b border-gray-200 pb-2 text-sm font-medium focus:outline-none focus:border-blue-400 transition-colors placeholder:text-gray-400 flex-1 text-gray-900"
                />
                {sources.length > 1 && (
                  <button
                    onClick={() => handleRemoveSource(index)}
                    className="mb-2 text-gray-300 hover:text-red-500 transition-colors text-xs"
                    aria-label="Remove source"
                  >
                    ✕
                  </button>
                )}
              </div>
              <select
                value={source.type}
                onChange={(e) => updateSource(index, "type", e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-full px-3 py-1 text-xs text-gray-600 focus:outline-none focus:border-blue-400 transition-colors w-fit cursor-pointer"
              >
                <option value="transcript">Transcript</option>
                <option value="textbook">Textbook</option>
                <option value="handwriting_ocr">Handwritten OCR</option>
                <option value="web_clip">Web Clip</option>
              </select>
              <textarea
                placeholder="Paste transcript or notes here..."
                value={source.content}
                onChange={(e) => updateSource(index, "content", e.target.value)}
                className="bg-transparent resize-none h-32 text-sm focus:outline-none placeholder:text-gray-400 leading-relaxed text-gray-700"
              />
            </div>
          ))}

          <button
            onClick={handleAddSource}
            className="flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-gray-300 text-gray-400 hover:text-gray-600 hover:border-gray-400 hover:bg-gray-50 transition-all text-sm font-medium"
          >
            <Plus size={16} /> Add Another Source
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200 sticky bottom-0 bg-white pb-2">
          {saving && <p className="text-xs text-gray-400 mb-3 flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Saving note...</p>}
          {error && <div className="text-red-600 text-sm mb-4 px-2 py-1 bg-red-50 rounded border border-red-200">{error}</div>}
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full bg-gray-900 hover:bg-gray-800 text-white py-3.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
            {loading ? "Synthesizing Notes..." : "Generate Professional Note"}
          </button>
        </div>
      </div>

      <div className={`flex-1 bg-gray-50 flex-col overflow-hidden ${mobileTab === "note" ? "flex" : "hidden"} md:flex`}>
        {note ? (
          <div className="flex-1 overflow-y-auto py-12 px-8">
            <div className="w-full max-w-4xl mx-auto h-full">
              <NoteEditor content={note} onChange={setNote} saveStatus={saveStatus} title={noteTitle} onTitleChange={setNoteTitle} />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 px-8 text-center max-w-md mx-auto">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-gray-200">
              <FileText size={24} className="text-gray-400" />
            </div>
            <h2 className="text-xl font-medium text-gray-700 mb-2">NotebookLM-Style Synthesis</h2>
            <p className="text-sm leading-relaxed">
              Paste your raw context on the left. We'll run it through the Layer 3 AI engine and render a beautifully formatted Markdown study guide right here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
