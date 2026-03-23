"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { LogOut, Plus, Trash2, Clock } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";

interface Note {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("notes")
      .select("id, title, content, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setNotes(data);
        setLoading(false);
      });
  }, [user]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await supabase.from("notes").delete().eq("id", id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const preview = (content: string) =>
    content.replace(/[#*_`>\-]/g, "").replace(/\s+/g, " ").trim().slice(0, 130);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
        <Image src="/synapse-logo.png" alt="Synapse" width={28} height={28} className="rounded-md" />
        <span className="text-lg font-bold text-gray-900 flex-1">Synapse</span>
        <span className="text-sm text-gray-400 hidden sm:block">{user?.email}</span>
        <button onClick={signOut} title="Sign out" className="text-gray-400 hover:text-gray-700 transition-colors ml-2">
          <LogOut size={16} />
        </button>
      </header>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-900">My Notes</h1>
          <button
            onClick={() => router.push("/note/new")}
            className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            <Plus size={15} /> New Note
          </button>
        </div>

        {loading ? (
          <div className="text-sm text-gray-400 mt-16 text-center">Loading...</div>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <div className="w-16 h-16 bg-white rounded-2xl border border-gray-200 flex items-center justify-center mb-5 shadow-sm">
              <FileText size={24} className="text-gray-300" />
            </div>
            <h2 className="text-lg font-medium text-gray-700 mb-2">No notes yet</h2>
            <p className="text-sm text-gray-400 mb-6">Upload a transcript or source to generate your first study guide.</p>
            <button
              onClick={() => router.push("/note/new")}
              className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus size={15} /> New Note
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {notes.map((note) => (
              <div
                key={note.id}
                onClick={() => router.push(`/note/${note.id}`)}
                className="bg-white rounded-xl border border-gray-200 p-5 cursor-pointer hover:border-gray-300 hover:shadow-sm transition-all group relative"
              >
                <button
                  onClick={(e) => handleDelete(e, note.id)}
                  title="Delete note"
                  className="absolute top-4 right-4 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 size={14} />
                </button>
                <h3 className="font-semibold text-gray-900 text-sm mb-2 pr-6 line-clamp-2 leading-snug">
                  {note.title || "Untitled Note"}
                </h3>
                {note.content && (
                  <p className="text-xs text-gray-400 line-clamp-3 mb-4 leading-relaxed">
                    {preview(note.content)}
                  </p>
                )}
                <div className="flex items-center gap-1.5 text-xs text-gray-300">
                  <Clock size={11} />
                  {formatDate(note.created_at)}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
