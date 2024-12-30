import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Navbar } from "@/app/components/navbar";
import { BackButton } from "@/app/components/back-button";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Prompt2PDF",
  description: "Create PDFs from prompts",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <div className="relative min-h-screen">
            <Navbar className="h-14" />
            <main>
              <div className="mx-auto max-w-7xl w-full">{children}</div>
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
