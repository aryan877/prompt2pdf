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
import { supabase } from "@/lib/supabase";

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
 * 1) Extract the LaTeX doc from GPT’s response.
 *    - Strips code fences ```latex ... ```
 *    - Finds \documentclass... up to \end{document}
 */
function extractLaTeXFromGPT(response: string): string {
  // Try code fence first
  const codeBlockRegex = /```latex\s([\s\S]*?)```/i;
  const fenceMatch = response.match(codeBlockRegex);
  if (fenceMatch && fenceMatch[1]) {
    const insideFences = fenceMatch[1].trim();
    // If there's random text before \documentclass, strip it
    if (!insideFences.startsWith("\\documentclass")) {
      const idx = insideFences.indexOf("\\documentclass");
      if (idx !== -1) {
        return insideFences.substring(idx).trim();
      }
    }
    return insideFences;
  }

  // Otherwise, look for \documentclass
  const docIndex = response.indexOf("\\documentclass");
  if (docIndex === -1) {
    // GPT gave no \documentclass at all
    return response.trim();
  }

  // Find \end{document}
  const endDocIndex = response.indexOf("\\end{document}", docIndex);
  if (endDocIndex !== -1) {
    return response.substring(docIndex, endDocIndex + 14).trim();
  }

  // If no \end{document}, return from docclass onward
  return response.substring(docIndex).trim();
}

/**
 * 2) Basic LaTeX sanitation
 *    - Remove minted / shell-escape
 *    - Remove unknown packages (optional)
 *    - Ensure we have \usepackage{listings} if GPT forgot
 *    - Ensure we have \begin{document} / \end{document} if GPT forgot
 */
function sanitizeLatex(input: string): string {
  let tex = input;

  // First ensure we have a proper document class
  if (!tex.includes("\\documentclass")) {
    tex = "\\documentclass{article}\n" + tex;
  }

  // Add essential packages at the start
  const essentialPackages = `
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{lmodern}
\\usepackage{textcomp}
\\usepackage{listings}
\\usepackage{xcolor}
\\usepackage{graphicx}
\\usepackage{amsmath}
\\usepackage{amssymb}
`;

  // Insert essential packages after documentclass
  const docClassMatch = tex.match(/\\documentclass(\[.*?\])?\{.*?\}/);
  if (docClassMatch) {
    const insertPos = docClassMatch.index! + docClassMatch[0].length;
    tex =
      tex.slice(0, insertPos) + "\n" + essentialPackages + tex.slice(insertPos);
  }

  // Remove problematic packages and commands
  tex = tex.replace(/\\usepackage(\[.*?\])?\{minted\}/g, "% removed minted");
  tex = tex.replace(/-shell-escape/g, "");
  tex = tex.replace(/\\usepackage\{.*?tikz.*?\}/g, "% removed tikz");
  tex = tex.replace(/\\usepackage\{.*?pgf.*?\}/g, "% removed pgf");
  tex = tex.replace(
    /\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\}/g,
    "% removed tikz content"
  );

  // (Optional) known packages only
  // If you want to remove ANY unknown packages:
  const knownPackages = [
    "amsmath",
    "amssymb",
    "geometry",
    "listings",
    "graphicx",
    "color",
    "xcolor",
    "hyperref",
    "url",
    "float",
    "caption",
    "subcaption",
    "enumitem",
    "array",
    "tabularx",
    "booktabs",
    "multirow",
    "longtable",
    "wrapfig",
    "fancyhdr",
    "lastpage",
    "titlesec",
    "inputenc",
    "fontenc",
    "lmodern",
    "textcomp",
    "mathtools",
  ];
  tex = tex.replace(
    /\\usepackage(\[.*?\])?\{([^}]+)\}/g,
    (fullMatch: string, opts: string, pkgNames: string) => {
      const pkgs: string[] = pkgNames.split(",").map((p: string) => p.trim());
      // Keep line only if every package is known
      const keep = pkgs.every((p: string) => knownPackages.includes(p));
      return keep ? fullMatch : `% removed unknown package(s): ${pkgNames}`;
    }
  );

  // If there's no \usepackage{listings}, we add it in the preamble
  if (!/\\usepackage(\[.*?\])?\{listings\}/.test(tex)) {
    // naive approach: insert after \documentclass line
    const docclassMatch = tex.match(/\\documentclass(\[.*?\])?\{.*?\}/);
    if (docclassMatch) {
      const insertPos = docclassMatch.index! + docclassMatch[0].length;
      tex =
        tex.slice(0, insertPos) +
        "\n\\usepackage{listings}\n" +
        tex.slice(insertPos);
    } else {
      // If GPT forgot \documentclass entirely, wrap the entire doc
      tex =
        "\\documentclass{article}\n\\usepackage{listings}\n\\begin{document}\n" +
        tex +
        "\n\\end{document}";
    }
  }

  // Ensure we have \begin{document} ... \end{document}
  if (!tex.includes("\\begin{document}")) {
    // We'll guess a spot (end of preamble) to insert \begin{document}
    // For simplicity, just append it if missing
    tex = tex + "\n\\begin{document}\n";
  }
  if (!tex.includes("\\end{document}")) {
    tex = tex + "\n\\end{document}\n";
  }

  return tex;
}

/**
 * 4) Compile .tex in Docker
 */
async function compileLatex(tex: string): Promise<CompilationResult> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "latex-"));

  try {
    // Create directories and write tex file
    await fs.mkdir(path.join(tempDir, "content"), { recursive: true });
    await fs.mkdir(path.join(tempDir, "output"), { recursive: true });

    const texFile = path.join(tempDir, "content", "doc.tex");
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
      // Run Docker compilation with absolute paths
      const contentPath = path.resolve(path.join(tempDir, "content"));
      const outputPath = path.resolve(path.join(tempDir, "output"));

      const dockerCmd = `docker run --rm \
        -v "${contentPath}:/latex/content:ro" \
        -v "${outputPath}:/latex/output" \
        latex-service`;

      console.log("Running Docker command:", dockerCmd);

      const { stdout, stderr } = await execAsync(dockerCmd);
      console.log("Docker stdout:", stdout);
      console.warn("Docker stderr:", stderr);
    } catch (error: any) {
      console.error("Docker compilation error:", error);

      // Try to read the log file even if Docker command failed
      const logPath = path.join(tempDir, "output", "compile.log");
      let logContent;
      try {
        logContent = await fs.readFile(logPath, "utf-8");
      } catch (logError) {
        logContent = "No compilation log available";
      }

      return {
        error: {
          message: "LaTeX compilation failed",
          details: `Docker Error: ${error?.message || "Unknown error"}`,
          latexLog: logContent,
        },
      };
    }

    // Check for PDF
    const pdfPath = path.join(tempDir, "output", "output.pdf");
    if (await fs.stat(pdfPath).catch(() => false)) {
      const pdfBuffer = await fs.readFile(pdfPath);
      return { pdfBuffer };
    }

    // If no PDF was generated, try to get the log
    const logPath = path.join(tempDir, "output", "compile.log");
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
  const supabase = createRouteHandlerClient({ cookies });

  // Check authentication
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
