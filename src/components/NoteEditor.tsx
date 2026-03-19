"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Loader2, Check, Download, ChevronDown } from "lucide-react";

interface NoteEditorProps {
  content: string;
  onChange: (val: string) => void;
  saveStatus: "idle" | "saving" | "saved" | "error";
  title: string;
  onTitleChange: (val: string) => void;
}

export default function NoteEditor({ content, onChange, saveStatus, title, onTitleChange }: NoteEditorProps) {
  const [mode, setMode] = useState<"preview" | "edit">("preview");
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filename = (title.trim() || "untitled-note").replace(/[^a-z0-9]/gi, "-").toLowerCase();

  const exportMd = () => {
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.md`;
    a.click();
    URL.revokeObjectURL(url);
    setExportOpen(false);
  };

  const exportPdf = () => {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title || "Note"}</title><style>
      body { font-family: Georgia, serif; max-width: 800px; margin: 40px auto; padding: 0 40px; color: #111; line-height: 1.7; }
      h1 { font-size: 2rem; margin-bottom: 0.5rem; }
      h2 { font-size: 1.4rem; margin-top: 2rem; border-bottom: 1px solid #ddd; padding-bottom: 0.3rem; }
      h3 { font-size: 1.1rem; margin-top: 1.5rem; }
      code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
      pre { background: #f4f4f4; padding: 16px; border-radius: 6px; overflow-x: auto; }
      blockquote { border-left: 4px solid #ddd; margin: 0; padding-left: 1rem; color: #555; }
      hr { border: none; border-top: 1px solid #ddd; margin: 2rem 0; }
      @media print { body { margin: 0; } }
    </style></head><body>${markdownToHtml(content)}</body></html>`;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
    setExportOpen(false);
  };

  const exportDocx = async () => {
    setExportOpen(false);
    const res = await fetch("/api/export/docx", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ html: markdownToHtml(content), title, filename }),
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full w-full">
      <input
        type="text"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="Untitled Note"
        className="bg-transparent text-2xl font-bold text-gray-900 placeholder:text-gray-400 focus:outline-none w-full mb-4 border-b border-transparent focus:border-gray-300 pb-2 transition-colors"
      />

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        {/* Mode toggle */}
        <div className="flex items-center gap-1 bg-gray-100 border border-gray-200 rounded-lg p-1">
          <button
            onClick={() => setMode("preview")}
            className={`px-3 py-1 text-sm rounded-md transition-all ${
              mode === "preview"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            Preview
          </button>
          <button
            onClick={() => setMode("edit")}
            className={`px-3 py-1 text-sm rounded-md transition-all ${
              mode === "edit"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            Edit
          </button>
        </div>

        {/* Export dropdown */}
        <div className="relative" ref={exportRef}>
          <button
            onClick={() => setExportOpen((o) => !o)}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-100 border border-gray-200"
          >
            <Download size={13} /> Export <ChevronDown size={11} />
          </button>
          {exportOpen && (
            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden min-w-[130px]">
              <button onClick={exportMd} className="w-full text-left px-4 py-2.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors">
                Markdown (.md)
              </button>
              <button onClick={exportPdf} className="w-full text-left px-4 py-2.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors">
                PDF (print)
              </button>
              <button onClick={exportDocx} className="w-full text-left px-4 py-2.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors">
                Word (.docx)
              </button>
            </div>
          )}
        </div>

        {/* Save status */}
        <div className="flex items-center gap-1.5 text-sm">
          {saveStatus === "saving" && (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              <span className="text-gray-400">Saving...</span>
            </>
          )}
          {saveStatus === "saved" && (
            <>
              <Check className="w-4 h-4 text-green-600" />
              <span className="text-green-600">Saved</span>
            </>
          )}
          {saveStatus === "error" && (
            <span className="text-red-500">Failed to save</span>
          )}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0 overflow-auto">
        {mode === "preview" ? (
          <div className="bg-white rounded-2xl p-10 border border-gray-200 shadow-sm h-full overflow-auto prose prose-gray max-w-none prose-headings:font-bold prose-h1:text-3xl prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4 prose-hr:border-gray-200">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        ) : (
          <textarea
            value={content}
            onChange={(e) => onChange(e.target.value)}
            className="bg-white text-gray-900 text-sm leading-relaxed resize-none w-full h-full p-8 focus:outline-none rounded-2xl border border-gray-200 shadow-sm"
            spellCheck={false}
          />
        )}
      </div>
    </div>
  );
}

// Minimal markdown → HTML converter for export (no extra deps)
function markdownToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/^\> (.+)$/gm, "<blockquote>$1</blockquote>")
    .replace(/^---$/gm, "<hr>")
    .replace(/^\- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>[\s\S]*?<\/li>)/g, "<ul>$1</ul>")
    .replace(/\n{2,}/g, "</p><p>")
    .replace(/^(?!<[hup]|<li|<block|<hr)(.+)$/gm, "<p>$1</p>")
    .replace(/<p><\/p>/g, "");
}
