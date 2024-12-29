#!/bin/bash
set -e

cd /latex/work

# Copy user-provided doc.tex to the working dir
cp /latex/content/doc.tex /latex/work/doc.tex

LOGFILE="/latex/work/compile.log"
echo "Starting LaTeX compilation..." > "$LOGFILE"

# Run pdflatex multiple times to resolve references
max_runs=3
success=false

for i in $(seq 1 $max_runs); do
    echo "Compilation attempt $i of $max_runs..." >> "$LOGFILE"
    
    if pdflatex -interaction=nonstopmode -halt-on-error doc.tex >> "$LOGFILE" 2>&1; then
        # Run bibtex if there are citations
        if grep -q "\\\\cite{" doc.tex || grep -q "\\\\bibliography{" doc.tex; then
            bibtex doc >> "$LOGFILE" 2>&1 || true
            pdflatex -interaction=nonstopmode -halt-on-error doc.tex >> "$LOGFILE" 2>&1
            pdflatex -interaction=nonstopmode -halt-on-error doc.tex >> "$LOGFILE" 2>&1
        fi
        success=true
        break
    fi
done

if [ "$success" = false ]; then
    echo "Error: LaTeX compilation failed after $max_runs attempts. See log below:" >> "$LOGFILE"
    mv "$LOGFILE" /latex/output/compile.log
    exit 1
fi

# If PDF compiled successfully
if [ -f doc.pdf ]; then
    mv doc.pdf /latex/output/output.pdf
    echo "Compilation successful!" >> "$LOGFILE"
    mv "$LOGFILE" /latex/output/compile.log
else
    echo "Error: PDF not generated despite successful compilation" >> "$LOGFILE"
    mv "$LOGFILE" /latex/output/compile.log
    exit 1
fi

# Clean auxiliary files
rm -f *.aux *.log *.out *.toc *.bbl *.blg *.nav *.snm
