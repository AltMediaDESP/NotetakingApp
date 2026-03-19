import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function useAutoSave(
  noteId: string | null,
  content: string,
  delay: number = 1000
): { status: SaveStatus } {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!noteId || !content) return;

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(async () => {
      setStatus("saving");

      const { error } = await supabase
        .from("notes")
        .update({ content, last_autosaved: new Date().toISOString() })
        .eq("id", noteId);

      if (error) {
        setStatus("error");
      } else {
        setStatus("saved");
        resetTimer.current = setTimeout(() => {
          setStatus("idle");
        }, 2000);
      }
    }, delay);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [noteId, content, delay]);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  return { status };
}
