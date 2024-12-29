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
 * 3) Auto-define languages used in \lstlisting to avoid "Couldn't load language"
 *    We'll scan for e.g. [language=rust], [language=plaintext], etc.,
 *    and create a fallback definition for each one found.
 */
function autoDefineLanguages(tex: string): string {
  // 1) Gather all unique [language=XYZ]
  const langRegex = /\[language=([^\]]+)\]/g;
  const langs = new Set<string>();
  let match;
  while ((match = langRegex.exec(tex)) !== null) {
    langs.add(match[1]);
  }

  if (langs.size === 0) {
    return tex; // no custom languages used
  }

  // 2) Build fallback definitions for each language
  //    We'll define them as a minimal style so LaTeX won't choke.
  let definitions = "";
  langs.forEach((lang) => {
    definitions += `
% Auto-defined fallback for language=${lang}
\\lstdefinelanguage{${lang}}{
  keywordstyle=\\bfseries,
  basicstyle=\\ttfamily,
  comment=[l]{//},
  morecomment=[s]{/*}{*/},
  morestring=[b]",
  sensitive=true
}
`;
  });

  // 3) Insert these definitions into the preamble (after \usepackage{listings})
  //    We'll do a naive approach:
  const useListingsRegex = /\\usepackage(\[.*?\])?\{listings\}/;
  const listingsMatch = tex.match(useListingsRegex);
  if (!listingsMatch || !listingsMatch.index) {
    // If for some reason we can't find \usepackage{listings}, just prepend
    return definitions + "\n" + tex;
  }

  // Insert right after \usepackage{listings}
  const insertPos = listingsMatch.index + listingsMatch[0].length;
  return (
    tex.slice(0, insertPos) + "\n" + definitions + "\n" + tex.slice(insertPos)
  );
}

/**
 * 4) Compile .tex in Docker
 */
async function compileLatex(fullLatex: string): Promise<{
  pdfBuffer?: Buffer;
  log?: string;
}> {
  // Temporary dir
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "latex-"));

  try {
    // Make content + output dirs
    await fs.mkdir(path.join(tempDir, "content"), { recursive: true });
    await fs.mkdir(path.join(tempDir, "output"), { recursive: true });

    // Save doc.tex
    const docPath = path.join(tempDir, "content", "doc.tex");
    await fs.writeFile(docPath, fullLatex, "utf-8");

    // Docker compile
    const dockerCmd = `docker run --rm \
      -v "${path.join(tempDir, "content")}:/latex/content:ro" \
      -v "${path.join(tempDir, "output")}:/latex/output" \
      latex-service`;

    try {
      const { stdout, stderr } = await execAsync(dockerCmd);
      console.log("Docker stdout:", stdout);
      console.warn("Docker stderr:", stderr);
    } catch (err) {
      console.error("Docker compile failed:", err);
      // Check for compile.log
      const logPath = path.join(tempDir, "output", "compile.log");
      if (await fs.stat(logPath).catch(() => false)) {
        const logData = await fs.readFile(logPath, "utf-8");
        return { pdfBuffer: undefined, log: logData };
      }
      return {
        pdfBuffer: undefined,
        log: "LaTeX compilation failed (no log found).",
      };
    }

    // If compiled, read output.pdf
    const pdfPath = path.join(tempDir, "output", "output.pdf");
    const pdfBuffer = await fs.readFile(pdfPath);
    return { pdfBuffer, log: undefined };
  } finally {
    // Cleanup
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

/**
 * Next.js route
 */
export async function POST(req: Request) {
  try {
    const { message } = await req.json();
    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // 1) Ask GPT for full doc
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `
You are Overleaf itself.

Guidelines:
1. Output ONLY a complete LaTeX file, from \\documentclass to \\end{document}.
2. Avoid minted or shell-escape references.
3. If user wants code in a given language, use \\lstlisting with [language=XYZ].
4. No extra text or code fences (like \`\`\`latex).
5. End with \\end{document}.
6. For bold text, use \\textbf{} instead of markdown-style ** or *.
7. For mathematical expressions, use proper LaTeX math mode with $ or $$ delimiters.
8. For matrices, use the \\begin{matrix} or \\begin{pmatrix} environment.
9. For enumerated lists, use \\begin{enumerate} with \\item.
          `,
        },
        {
          role: "user",
          content: message.replace(/\*\*(.*?)\*\*/g, "\\textbf{$1}"),
        },
      ],
      temperature: 0.3,
    });

    const gptResponse = completion.choices[0].message?.content || "";
    if (!gptResponse) {
      throw new Error("GPT returned an empty LaTeX document");
    }

    // 2) Extract doc
    let tex = extractLaTeXFromGPT(gptResponse);

    // 3) Sanitize doc (remove minted, unknown packages, ensure doc structure)
    tex = sanitizeLatex(tex);

    // 4) Auto-define any custom [language=XYZ]
    tex = autoDefineLanguages(tex);

    // 5) Compile
    const { pdfBuffer, log } = await compileLatex(tex);
    if (!pdfBuffer) {
      return NextResponse.json(
        { error: "LaTeX compilation failed", log },
        { status: 500 }
      );
    }

    // 6) Upload PDF to S3
    const key = `pdfs/${Date.now()}.pdf`;
    await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME!,
        Key: key,
        Body: pdfBuffer,
        ContentType: "application/pdf",
      })
    );

    // 7) Generate signed URL
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME!,
      Key: key,
    });
    const pdfUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    // Return final doc + PDF link
    return NextResponse.json({
      pdfUrl,
      fullLatex: tex,
    });
  } catch (error: any) {
    console.error("Error in /api/chat (LaTeX full doc):", error);
    return NextResponse.json(
      { error: error.message || "Unknown error" },
      { status: 500 }
    );
  }
}
