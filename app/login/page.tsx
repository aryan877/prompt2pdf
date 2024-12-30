"use client";

import { useEffect, useState } from "react";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { useRouter, useSearchParams } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectedFrom") || "/dashboard";
  const [mounted, setMounted] = useState(false);
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

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-full max-w-md p-8 bg-white/5 rounded-2xl backdrop-blur-xl border border-white/10">
          <h1 className="text-2xl font-bold text-center mb-8">
            Welcome to Prompt2Pdf
          </h1>
          <div className="animate-pulse flex space-x-4">
            <div className="flex-1 space-y-4 py-1">
              <div className="h-12 bg-white/5 rounded"></div>
              <div className="h-12 bg-white/5 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md p-8 bg-white/5 rounded-2xl backdrop-blur-xl border border-white/10">
        <h1 className="text-2xl font-bold text-center mb-8">
          Welcome to Prompt2Pdf
        </h1>
        <Auth
          supabaseClient={supabase}
          appearance={{
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: "#10b981",
                  brandAccent: "#059669",
                },
              },
            },
          }}
          providers={["google"]}
          view="sign_in"
          showLinks={false}
          redirectTo={`${
            typeof window !== "undefined" ? window.location.origin : ""
          }/api/auth/callback?redirect=${redirectTo}`}
        />
      </div>
    </div>
  );
}
