#!/bin/bash
set -e

echo "Starting LaTeX compilation..."

# Debug: List contents of directories
echo "Contents of /latex/content:"
ls -la /latex/content

# Create content directory if it doesn't exist
mkdir -p /latex/work/content

# Copy input file to work/content directory
cp /latex/content/input.tex /latex/work/content/

# Change to work directory where template is
cd /latex/work

# Run pdflatex twice to handle references
echo "First pdflatex run..."
pdflatex -interaction=nonstopmode latex-template.tex || {
    echo "First pdflatex run failed. Log contents:"
    cat latex-template.log
    exit 1
}

echo "Second pdflatex run..."
pdflatex -interaction=nonstopmode latex-template.tex || {
    echo "Second pdflatex run failed. Log contents:"
    cat latex-template.log
    exit 1
}

# Check if PDF was generated
if [ ! -f latex-template.pdf ]; then
    echo "PDF generation failed. Log contents:"
    cat latex-template.log
    exit 1
fi

# Copy the output
cp latex-template.pdf /latex/output/output.pdf

echo "PDF generation completed successfully!" 