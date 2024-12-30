"use client";

import { useState, useRef } from "react";
import { Bot, FileDown, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface CompilationError {
  error: string;
  details?: string;
  latexLog?: string;
  generatedTex?: string;
}

export function ChatInterface() {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<CompilationError | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target;
    setInput(textarea.value);
    textarea.style.height = "50px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    setIsLoading(true);
    setPdfUrl(null);
    setError(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data);
        return;
      }

      setPdfUrl(data.pdfUrl);
      setInput("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "50px";
      }
    } catch (error) {
      console.error("Error:", error);
      setError({
        error: "Failed to process request",
        details: "An unexpected error occurred. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Scrollable messages area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 md:px-8 h-full">
          {error ? (
            // Error state
            <div className="flex flex-col items-center justify-center h-full p-6">
              <div className="text-center space-y-6 max-w-2xl">
                <div className="w-20 h-20 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-10 h-10 text-red-500" />
                </div>
                <div className="space-y-4">
                  <p className="text-red-500 text-lg font-medium">
                    {error.error}
                  </p>
                  {error.details && (
                    <p className="text-zinc-400 text-sm">{error.details}</p>
                  )}
                  {error.latexLog && (
                    <div className="mt-4">
                      <p className="text-zinc-400 text-sm mb-2">
                        Compilation Log:
                      </p>
                      <pre className="bg-black/50 p-4 rounded-lg text-xs text-zinc-300 overflow-x-auto max-h-48 overflow-y-auto">
                        {error.latexLog}
                      </pre>
                    </div>
                  )}
                  {error.generatedTex && (
                    <div className="mt-4">
                      <p className="text-zinc-400 text-sm mb-2">
                        Generated LaTeX:
                      </p>
                      <pre className="bg-black/50 p-4 rounded-lg text-xs text-zinc-300 overflow-x-auto max-h-48 overflow-y-auto">
                        {error.generatedTex}
                      </pre>
                    </div>
                  )}
                  <Button
                    onClick={() => setError(null)}
                    variant="outline"
                    className="mt-4"
                  >
                    Try Again
                  </Button>
                </div>
              </div>
            </div>
          ) : !pdfUrl ? (
            // Initial state or loading
            <div className="flex flex-col items-center justify-center h-full p-6">
              <div className="text-center space-y-4">
                <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto">
                  <Bot className="w-10 h-10 text-emerald-500" />
                </div>
                <p className="text-zinc-400 text-lg max-w-sm">
                  Describe what you want to create and I&apos;ll generate a PDF
                  for you
                </p>
              </div>
            </div>
          ) : (
            // PDF download section
            <div className="flex flex-col items-center justify-center h-full p-6">
              <div className="text-center space-y-6">
                <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto">
                  <FileDown className="w-10 h-10 text-emerald-500" />
                </div>
                <div className="space-y-2">
                  <p className="text-zinc-200 text-lg">Your PDF is ready!</p>
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors"
                  >
                    <FileDown className="w-5 h-5" />
                    Download PDF
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fixed input area */}
      <div className="flex-none border-t border-white/10 bg-zinc-950/50 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/50">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <form onSubmit={handleSubmit} className="flex gap-3">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextareaChange}
              placeholder="Describe what content you want to create..."
              className="min-h-[50px] max-h-[200px] resize-none bg-white/5 border-0 focus:ring-1 focus:ring-emerald-500/50 rounded-xl placeholder:text-zinc-400 text-base overflow-y-auto"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            <Button
              type="submit"
              size="icon"
              disabled={isLoading}
              className={cn(
                "h-[50px] w-[50px] rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white shrink-0",
                "transition-all duration-200 ease-in-out",
                isLoading && "opacity-50 cursor-not-allowed"
              )}
            >
              {isLoading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <FileDown className="w-6 h-6" />
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
