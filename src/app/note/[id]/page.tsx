"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import Image from "next/image";
import { Loader2, Plus, Send, LogOut, ArrowLeft, Trash2, Upload } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";
import { useAutoSave } from "@/hooks/useAutoSave";
import NoteEditor from "@/components/NoteEditor";

export default function NotePage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === "new";
  const router = useRouter();
  const { user, signOut } = useAuth();

  const [sources, setSources] = useState([{ id: uuidv4(), title: "", content: "", type: "transcript" }]);
  const [note, setNote] = useState<string | null>(null);
  const [noteId, setNoteId] = useState<string | null>(isNew ? null : id);
  const [noteTitle, setNoteTitle] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [mobileTab, setMobileTab] = useState<"sources" | "note">("sources");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const { status: saveStatus } = useAutoSave(noteId, note ?? "", 1000);

  // Load existing note
  useEffect(() => {
    if (isNew || !user) return;
    supabase
      .from("notes")
      .select("content, title")
      .eq("id", id)
      .single()
      .then(({ data, error }) => {
        if (data) {
          setNote(data.content);
          setNoteTitle(data.title ?? "");
          setMobileTab("note");
        } else if (error) {
          setLoadError(true);
        }
      });
  }, [id, isNew, user]);

  // Auto-save title changes
  useEffect(() => {
    if (!noteId || !noteTitle.trim()) return;
    const timer = setTimeout(async () => {
      await supabase.from("notes").update({ title: noteTitle }).eq("id", noteId);
    }, 1000);
    return () => clearTimeout(timer);
  }, [noteTitle, noteId]);

  const updateSource = (index: number, field: "title" | "content" | "type", value: string) => {
    const newSources = [...sources];
    newSources[index][field] = value;
    setSources(newSources);
  };

  const handleAddSource = () => {
    setSources([...sources, { id: uuidv4(), title: "", content: "", type: "transcript" }]);
  };

  const handleRemoveSource = (index: number) => {
    setSources(sources.filter((_, i) => i !== index));
  };

  const handleFileUpload = async (index: number, file: File) => {
    if (file.name.endsWith(".txt")) {
      const text = await file.text();
      updateSource(index, "content", text);
      if (!sources[index].title) updateSource(index, "title", file.name.replace(".txt", ""));
      return;
    }
    if (file.name.endsWith(".pdf")) {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/parse-file", { method: "POST", body: formData });
      const data = await res.json();
      if (data.text) {
        updateSource(index, "content", data.text);
        if (!sources[index].title) updateSource(index, "title", file.name.replace(".pdf", ""));
      } else {
        setError(data.error ?? "Failed to parse file");
      }
      return;
    }
    setError("Unsupported file type. Use .pdf or .txt");
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

      if (noteId) {
        await supabase.from("notes").update({
          title: firstHeading,
          content: markdown,
          source_ids: sourceIds,
          last_autosaved: new Date().toISOString(),
        }).eq("id", noteId);
        setNoteTitle(firstHeading);
      } else {
        const { data: noteData, error: noteError } = await supabase.from("notes").insert({
          user_id: user.id,
          title: firstHeading,
          content: markdown,
          source_ids: sourceIds,
          is_ai_generated: true,
          last_autosaved: new Date().toISOString(),
        }).select("id").single();

        if (noteError) throw noteError;
        if (noteData) {
          setNoteId(noteData.id);
          router.replace(`/note/${noteData.id}`);
        }
        setNoteTitle(firstHeading);
      }
    } catch (e) {
      console.error("Failed to save:", e);
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
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setMobileTab("sources");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!noteId) return;
    await supabase.from("notes").delete().eq("id", noteId);
    router.push("/");
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

      {/* Sidebar */}
      <div className={`w-full md:w-1/3 md:min-w-[350px] border-r border-gray-200 bg-white p-6 flex flex-col overflow-y-auto ${mobileTab === "sources" ? "flex" : "hidden"} md:flex`}>
        <div className="flex items-center gap-2 mb-6">
          <button onClick={() => router.push("/")} className="text-gray-400 hover:text-gray-700 transition-colors" title="Back to dashboard">
            <ArrowLeft size={16} />
          </button>
          <Image src="/synapse-logo.png" alt="Synapse" width={22} height={22} className="rounded-md" />
          <h1 className="text-xl font-bold tracking-tight flex-1">Synapse</h1>
          {noteId && (
            confirmDelete ? (
              <div className="flex items-center gap-1.5">
                <button onClick={handleDelete} className="text-xs text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded transition-colors">
                  Delete
                </button>
                <button onClick={() => setConfirmDelete(false)} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} title="Delete note" className="text-gray-300 hover:text-red-500 transition-colors">
                <Trash2 size={15} />
              </button>
            )
          )}
          <button onClick={signOut} title="Sign out" className="text-gray-400 hover:text-gray-700 transition-colors">
            <LogOut size={15} />
          </button>
        </div>
        {user && <p className="text-xs text-gray-400 -mt-4 mb-6 truncate">{user.email}</p>}

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
                  <button onClick={() => handleRemoveSource(index)} className="mb-2 text-gray-300 hover:text-red-500 transition-colors text-xs" aria-label="Remove source">
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
              {source.content.trim() && (
                <span className="text-xs text-gray-300">
                  {source.content.trim().split(/\s+/).length} words
                </span>
              )}
              <label className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 cursor-pointer transition-colors w-fit">
                <Upload size={12} />
                Upload .pdf or .txt
                <input
                  type="file"
                  accept=".pdf,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(index, file);
                    e.target.value = "";
                  }}
                />
              </label>
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
            {loading ? "Synthesizing Notes..." : noteId ? "Regenerate Note" : "Generate Professional Note"}
          </button>
        </div>
      </div>

      {/* Note area */}
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
              <Image src="/synapse-logo.png" alt="Synapse" width={24} height={24} className="rounded-md opacity-40" />
            </div>
            <h2 className="text-xl font-medium text-gray-700 mb-2">
              {isNew ? "Add sources to get started" : loadError ? "Note not found" : "Loading note..."}
            </h2>
            <p className="text-sm leading-relaxed">
              {isNew ? "Paste your raw context on the left and hit Generate." : loadError ? "This note may have been deleted or you don't have access to it." : ""}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
