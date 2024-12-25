"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { Message } from "@/app/types/chat";

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target;
    setInput(textarea.value);

    // Reset height to auto to accurately calculate scroll height
    textarea.style.height = "50px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, newMessage]);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "50px";
    }
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input }),
      });

      const data = await response.json();

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: data.message,
          timestamp: new Date(),
          pdfUrl: data.pdfUrl,
          type: data.type,
        },
      ]);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-black/40 rounded-2xl backdrop-blur-xl border border-white/5 max-w-5xl mx-auto w-full">
      <div className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto">
                <Bot className="w-10 h-10 text-emerald-500" />
              </div>
              <p className="text-zinc-400 text-lg max-w-sm">
                Ask me anything about your PDFs
              </p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message, index) => (
              <div
                key={message.id}
                className={cn(
                  "flex items-start gap-4 w-full max-w-3xl mx-auto",
                  message.role === "user" ? "flex-row-reverse" : "flex-row"
                )}
              >
                <div className="flex flex-col items-center mt-1">
                  <Avatar className="w-10 h-10 border-2 border-emerald-500/20">
                    <AvatarImage
                      src={
                        message.role === "user"
                          ? "/user-avatar.png"
                          : "/bot-avatar.png"
                      }
                    />
                    <AvatarFallback className="bg-emerald-500/10 text-emerald-500">
                      {message.role === "user" ? "You" : "AI"}
                    </AvatarFallback>
                  </Avatar>
                </div>

                <div className="flex flex-col gap-2 flex-1">
                  <div
                    className={cn(
                      "px-6 py-3.5 rounded-2xl text-base leading-relaxed shadow-md",
                      message.role === "user"
                        ? "bg-emerald-500 text-white rounded-tr-none ml-auto"
                        : "bg-zinc-800/70 text-zinc-100 rounded-tl-none border border-white/10 mr-auto"
                    )}
                  >
                    {message.content}
                  </div>
                  {message.role === "assistant" && message.pdfUrl && (
                    <a
                      href={message.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-emerald-500 hover:text-emerald-400 transition-colors mt-1"
                    >
                      <svg
                        className="w-5 h-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      Download Solution PDF
                    </a>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex items-start gap-4 w-full max-w-3xl mx-auto">
                <div className="flex flex-col items-center mt-1">
                  <Avatar className="w-10 h-10 border-2 border-emerald-500/20">
                    <AvatarImage src="/bot-avatar.png" />
                    <AvatarFallback className="bg-emerald-500/10 text-emerald-500">
                      AI
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="flex flex-col gap-2 flex-1">
                  <div className="px-6 py-3.5 rounded-2xl text-base leading-relaxed shadow-md bg-zinc-800/70 text-zinc-100 rounded-tl-none border border-white/10 mr-auto w-24">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 rounded-full bg-zinc-400 animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-2 h-2 rounded-full bg-zinc-400 animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-2 h-2 rounded-full bg-zinc-400 animate-bounce" />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="shrink-0 p-6 border-t border-white/5 bg-black/20">
        <form onSubmit={handleSubmit} className="flex gap-3 max-w-3xl mx-auto">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={handleTextareaChange}
            placeholder="Ask a question..."
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
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent" />
            ) : (
              <Send className="h-6 w-6" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
