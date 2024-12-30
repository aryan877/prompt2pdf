import { ChatInterface } from "./components/chat/chat-interface";

export default function Home() {
  return (
    <main className="h-[calc(100vh-56px)] flex flex-col">
      <h1 className="text-4xl font-bold text-center h-[72px] flex items-center justify-center flex-none">
        <span className="bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
          Prompt2Pdf
        </span>
      </h1>
      <div className="flex-1">
        <ChatInterface />
      </div>
    </main>
  );
}
