"use client";

import { useCallback, useEffect, useState } from "react";
import { FileDown, Loader2, Search, XCircle } from "lucide-react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/hooks/use-debounce";
import { useRouter } from "next/navigation";

interface PdfGeneration {
  id: string;
  created_at: string;
  prompt: string;
  pdf_url: string;
  user_id: string;
}

export default function GenerationsPage() {
  const router = useRouter();
  const [generations, setGenerations] = useState<PdfGeneration[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery);
  const itemsPerPage = 10;
  const supabase = createClientComponentClient();

  const fetchGenerations = useCallback(async () => {
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;
      if (!session) {
        router.push("/login");
        return;
      }

      console.log("Fetching generations for user:", session.user.id);

      const { data, error } = await supabase
        .from("pdf_generations")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .range((page - 1) * itemsPerPage, page * itemsPerPage - 1);

      if (error) {
        console.error("Database error:", error);
        throw error;
      }

      console.log("Fetched generations:", data);
      setGenerations(data || []);
    } catch (error) {
      console.error("Error fetching generations:", error);
    } finally {
      setLoading(false);
    }
  }, [page, itemsPerPage, supabase, router]);

  useEffect(() => {
    fetchGenerations();
  }, [fetchGenerations]);

  // Filter generations based on debounced search
  const filteredGenerations = generations.filter((gen) =>
    gen.prompt.toLowerCase().includes(debouncedSearch.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center flex-1">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center w-full">
      <div className="w-full max-w-7xl px-4 py-8 space-y-8">
        <div className="flex flex-col space-y-4">
          <h1 className="text-2xl font-bold">Your PDF Generations</h1>

          {/* Search input */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400 h-4 w-4" />
            <Input
              type="text"
              placeholder="Search generations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white/5 border-white/10"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-400 hover:text-zinc-300"
              >
                <XCircle className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-4 w-full">
          {filteredGenerations.map((gen) => (
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

        {filteredGenerations.length === 0 && (
          <div className="text-center py-8">
            <p className="text-zinc-400">
              {searchQuery
                ? "No generations found matching your search"
                : "No PDF generations yet"}
            </p>
          </div>
        )}

        {!searchQuery && generations.length === itemsPerPage && (
          <div className="flex justify-center mt-8 gap-4">
            {page > 1 && (
              <Button
                onClick={() => setPage((p) => p - 1)}
                variant="outline"
                className="bg-white/5 hover:bg-white/10"
              >
                Previous
              </Button>
            )}
            <Button
              onClick={() => setPage((p) => p + 1)}
              variant="outline"
              className="bg-white/5 hover:bg-white/10"
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
