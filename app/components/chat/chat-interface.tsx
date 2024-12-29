"use client";

import { useState, useRef } from "react";
import { Bot, FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface PDFResponse {
  pdfUrl: string;
  error?: string;
}

export function ChatInterface() {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
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

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input }),
      });
      const data: PDFResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate PDF");
      }

      setPdfUrl(data.pdfUrl);
      setInput("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "50px";
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-black/40 rounded-2xl backdrop-blur-xl border border-white/5 max-w-5xl mx-auto w-full p-6">
      {/* Main content area */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6">
        {!pdfUrl ? (
          // Initial state or loading
          <div className="text-center space-y-4">
            <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto">
              <Bot className="w-10 h-10 text-emerald-500" />
            </div>
            <p className="text-zinc-400 text-lg max-w-sm">
              Describe what you want to create and I&apos;ll generate a PDF for
              you
            </p>
          </div>
        ) : (
          // PDF download section
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
        )}
      </div>

      {/* Input area */}
      <div className="shrink-0 mt-6">
        <form onSubmit={handleSubmit} className="flex gap-3 max-w-3xl mx-auto">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={handleTextareaChange}
            placeholder="Describe what content you want to create..."
            className="min-h-[56px] max-h-[200px] resize-none bg-white/5 border-0 focus:ring-1 focus:ring-emerald-500/50 rounded-xl placeholder:text-zinc-400 text-base"
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
              "h-[56px] w-[56px] rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white shrink-0",
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
  );
}
