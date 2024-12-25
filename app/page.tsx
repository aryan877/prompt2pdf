import { ChatInterface } from "./components/chat/chat-interface";

export default function Home() {
  return (
    <main className="fixed inset-0 bg-zinc-950 overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.1),transparent_50%)]" />
      <div className="fixed pointer-events-none inset-0 bg-[url('/grid.svg')] bg-center [mask-image:radial-gradient(white,transparent_85%)]" />

      <div className="relative h-full flex flex-col p-4">
        <h1 className="text-4xl font-bold text-center mb-4 flex-none">
          <span className="bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
            PDFly
          </span>
        </h1>
        <div className="flex-1 min-h-0">
          <ChatInterface />
        </div>
      </div>
    </main>
  );
}
