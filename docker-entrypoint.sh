#!/bin/bash
set -e

cd /latex/work

echo "Starting LaTeX compilation..." > /latex/output/compile.log

# Copy user-provided doc.tex to the working dir
if ! cp /latex/content/doc.tex /latex/work/doc.tex; then
    echo "Failed to copy LaTeX file" >> /latex/output/compile.log
    exit 1
fi

# Run pdflatex multiple times to resolve references
max_runs=3
success=false

for i in $(seq 1 $max_runs); do
    echo "Compilation attempt $i of $max_runs..." >> /latex/output/compile.log
    
    if pdflatex -interaction=nonstopmode -halt-on-error doc.tex >> /latex/output/compile.log 2>&1; then
        # Run bibtex if there are citations
        if grep -q "\\\\cite{" doc.tex || grep -q "\\\\bibliography{" doc.tex; then
            echo "Running BibTeX..." >> /latex/output/compile.log
            bibtex doc >> /latex/output/compile.log 2>&1 || true
            pdflatex -interaction=nonstopmode -halt-on-error doc.tex >> /latex/output/compile.log 2>&1
            pdflatex -interaction=nonstopmode -halt-on-error doc.tex >> /latex/output/compile.log 2>&1
        fi
        success=true
        break
    fi
done

if [ "$success" = false ]; then
    echo "Error: LaTeX compilation failed after $max_runs attempts." >> /latex/output/compile.log
    exit 1
fi

# If PDF compiled successfully
if [ -f doc.pdf ]; then
    mv doc.pdf /latex/output/output.pdf
    echo "Compilation successful!" >> /latex/output/compile.log
else
    echo "Error: PDF not generated despite successful compilation" >> /latex/output/compile.log
    exit 1
fi

# Clean auxiliary files
rm -f *.aux *.log *.out *.toc *.bbl *.blg *.nav *.snm
