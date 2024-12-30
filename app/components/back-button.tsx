"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function BackButton() {
  const router = useRouter();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => router.back()}
      className="gap-2 pl-0 hover:pl-2 transition-all"
    >
      <ChevronLeft className="h-4 w-4" />
      Back
    </Button>
  );
}
