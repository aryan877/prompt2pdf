export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  pdfUrl?: string;
  type?: "simple" | "detailed";
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  latestPdfUrl: string | null;
}
