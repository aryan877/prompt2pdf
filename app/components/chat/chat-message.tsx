import { cn } from "@/lib/utils";
import type { Message } from "@/app/types/chat";
import { Card } from "@/components/ui/card";

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  return (
    <Card
      className={cn(
        "p-4",
        message.role === "user"
          ? "bg-primary text-primary-foreground ml-12"
          : "bg-muted mr-12"
      )}
    >
      <div className="flex flex-col gap-1">
        <div className="text-sm font-medium">
          {message.role === "user" ? "You" : "Assistant"}
        </div>
        <div className="text-sm">{message.content}</div>
      </div>
    </Card>
  );
}
