"use client";

import { useCallback, useEffect, useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface PdfGeneration {
  id: string;
  created_at: string;
  prompt: string;
  pdf_url: string;
  user_id: string;
}

export default function DashboardPage() {
  const [generations, setGenerations] = useState<PdfGeneration[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  const fetchGenerations = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("pdf_generations")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .range((page - 1) * itemsPerPage, page * itemsPerPage - 1);

      if (error) throw error;
      setGenerations(data || []);
    } catch (error) {
      console.error("Error fetching generations:", error);
    } finally {
      setLoading(false);
    }
  }, [page, itemsPerPage]);

  useEffect(() => {
    fetchGenerations();
  }, [page, fetchGenerations]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-8">Your PDF Generations</h1>

      <div className="grid gap-4">
        {generations.map((gen) => (
          <div
            key={gen.id}
            className="bg-white/5 p-4 rounded-lg border border-white/10 flex items-center justify-between"
          >
            <div className="flex-1">
              <p className="text-zinc-200 mb-2">{gen.prompt}</p>
              <p className="text-sm text-zinc-400">
                {new Date(gen.created_at).toLocaleDateString()}
              </p>
            </div>
            <a
              href={gen.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors ml-4"
            >
              <FileDown className="w-4 h-4" />
              Download
            </a>
          </div>
        ))}
      </div>

      {generations.length === 0 && (
        <div className="text-center py-8">
          <p className="text-zinc-400">No PDF generations yet</p>
        </div>
      )}

      {generations.length === itemsPerPage && (
        <div className="flex justify-center mt-8 gap-4">
          {page > 1 && (
            <button
              onClick={() => setPage((p) => p - 1)}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
            >
              Previous
            </button>
          )}
          <button
            onClick={() => setPage((p) => p + 1)}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
