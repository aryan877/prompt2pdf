"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { FcGoogle } from "react-icons/fc";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectedFrom") || "/";
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClientComponentClient();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        router.push(redirectTo);
      }
    };
    checkUser();
  }, [redirectTo, router, supabase]);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback?redirect=${redirectTo}`,
        },
      });
    } catch (error) {
      console.error("Error:", error);
      setIsLoading(false);
    }
  };

  if (!mounted) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center p-4 bg-gradient-to-b from-background to-background/50">
      <div className="relative">
        {/* Gradient blobs */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl transform -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl transform translate-x-1/2 translate-y-1/2" />
        </div>

        <div className="w-full max-w-md p-8 bg-black/40 rounded-2xl backdrop-blur-xl border border-white/10">
          <div className="space-y-8">
            <div className="space-y-2 text-center">
              <div className="flex justify-center mb-6">
                <div className="p-3 bg-white/5 rounded-2xl">
                  <Image
                    src="/logo.png"
                    alt="Logo"
                    width={48}
                    height={48}
                    className="w-12 h-12"
                  />
                </div>
              </div>
              <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
                Welcome to Prompt2PDF
              </h1>
              <p className="text-zinc-400 text-sm">
                Sign in to start generating PDFs from prompts
              </p>
            </div>

            <div className="space-y-4">
              <Button
                variant="outline"
                className="w-full h-11 bg-white hover:bg-white/90 text-black border-0 transition-colors"
                onClick={handleGoogleLogin}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FcGoogle className="w-4 h-4 mr-2" />
                )}
                Continue with Google
              </Button>
            </div>

            <div className="text-center">
              <p className="text-xs text-zinc-500">
                By continuing, you agree to our Terms of Service and Privacy
                Policy
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
