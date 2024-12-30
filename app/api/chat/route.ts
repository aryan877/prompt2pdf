import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import os from "os";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import OpenAI from "openai";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { rateLimitMiddleware } from "@/lib/rate-limit";

const execAsync = promisify(exec);

/**
 * Initialize OpenAI
 */
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Initialize S3
 */
const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

interface CompilationResult {
  pdfBuffer?: Buffer;
  error?: {
    message: string;
    details?: string;
    latexLog?: string;
  };
}

/**
 * 4) Compile .tex directly using system LaTeX
 */
async function compileLatex(tex: string): Promise<CompilationResult> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "latex-"));
  const workDir = path.join(tempDir, "work");

  try {
    // Create work directory
    await fs.mkdir(workDir, { recursive: true });

    // Write tex file
    const texFile = path.join(workDir, "doc.tex");
    await fs.writeFile(texFile, tex, "utf-8");

    // Verify the file was written
    const fileContent = await fs.readFile(texFile, "utf-8");
    if (!fileContent) {
      return {
        error: {
          message: "Failed to write LaTeX file",
          details: "The LaTeX content could not be written to disk",
        },
      };
    }

    try {
      // Change to work directory for compilation
      const currentDir = process.cwd();
      process.chdir(workDir);

      // Run pdflatex
      const { stdout, stderr } = await execAsync(
        "pdflatex -interaction=nonstopmode -halt-on-error doc.tex"
      );
      console.log("LaTeX stdout:", stdout);
      console.warn("LaTeX stderr:", stderr);

      // Change back to original directory
      process.chdir(currentDir);
    } catch (error: any) {
      console.error("LaTeX compilation error:", error);

      // Try to read the log file
      const logPath = path.join(workDir, "doc.log");
      let logContent;
      try {
        logContent = await fs.readFile(logPath, "utf-8");
      } catch (logError) {
        logContent = "No compilation log available";
      }

      return {
        error: {
          message: "LaTeX compilation failed",
          details: `Error: ${error?.message || "Unknown error"}`,
          latexLog: logContent,
        },
      };
    }

    // Check for PDF
    const pdfPath = path.join(workDir, "doc.pdf");
    if (await fs.stat(pdfPath).catch(() => false)) {
      const pdfBuffer = await fs.readFile(pdfPath);
      return { pdfBuffer };
    }

    // If no PDF was generated, try to get the log
    const logPath = path.join(workDir, "doc.log");
    const logContent = await fs.readFile(logPath, "utf-8").catch(() => null);

    return {
      error: {
        message: "LaTeX compilation failed",
        details: "No PDF was generated",
        latexLog: logContent || "No compilation log available",
      },
    };
  } finally {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true }).catch(console.error);
  }
}

/**
 * Next.js route
 */
export async function POST(req: Request) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  // Check authentication
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Apply rate limiting (5 requests per minute per user)
  const rateLimitResult = await rateLimitMiddleware(req, session.user.id, {
    interval: 60, // 1 minute
    limit: 5, // 5 requests
  });

  if (rateLimitResult) {
    return rateLimitResult;
  }

  try {
    const { message } = await req.json();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a LaTeX expert. Convert the user's request into a complete, compilable LaTeX document.

Guidelines:
1. Always start with:
   \\documentclass{article}
   \\usepackage[utf8]{inputenc}
   \\usepackage[T1]{fontenc}
   \\usepackage{amsmath,amssymb}
   \\usepackage{graphicx}

2. For text formatting:
   - Bold: \\textbf{text}
   - Italic: \\textit{text}
   - Code: \\begin{verbatim}...\\end{verbatim}

3. For math:
   - Inline math: $...$ 
   - Display math: \\[...\\] or $$...$$
   - Matrices: \\begin{pmatrix}...\\end{pmatrix}
   - Aligned equations: \\begin{align*}...\\end{align*}

4. Document structure:
   - Always include \\begin{document} and \\end{document}
   - Use \\section{} for main sections
   - Use \\subsection{} for subsections
   - Use itemize/enumerate for lists

5. Output ONLY the complete LaTeX code with no explanations or markdown`,
        },
        { role: "user", content: message },
      ],
      temperature: 0.3,
    });

    const tex = completion.choices[0].message?.content || "";
    if (!tex) {
      throw new Error("Failed to generate LaTeX");
    }

    const result = await compileLatex(tex);
    if (result.error) {
      return NextResponse.json(
        {
          error: result.error.message,
          details: result.error.details,
          latexLog: result.error.latexLog,
          generatedTex: tex, // Include the generated LaTeX for debugging
        },
        { status: 500 }
      );
    }

    const key = `pdfs/${Date.now()}.pdf`;
    await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME!,
        Key: key,
        Body: result.pdfBuffer,
        ContentType: "application/pdf",
      })
    );

    const command = new GetObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME!,
      Key: key,
    });
    const pdfUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    // After successful PDF generation and upload to S3, store in Supabase
    const { error: dbError } = await supabase.from("pdf_generations").insert({
      user_id: session.user.id,
      prompt: message,
      pdf_url: pdfUrl, // This should be the S3 URL from your existing code
      status: "success",
    });

    if (dbError) throw dbError;

    return NextResponse.json({ pdfUrl });
  } catch (error: any) {
    console.error("Error:", error);

    // If there's an error, try to log it in the database if we have a user ID
    if (session?.user?.id) {
      try {
        await supabase.from("pdf_generations").insert({
          user_id: session.user.id,
          prompt: error.message || "Unknown error",
          pdf_url: "",
          status: "error",
        });
      } catch (dbError) {
        console.error("Failed to log error to database:", dbError);
      }
    }

    return NextResponse.json(
      {
        error: "Failed to generate PDF",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
