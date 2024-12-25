#!/bin/bash
set -e

# Copy template
cp /latex/template.tex /latex/main.tex

# Append content
cat /latex/content.tex >> /latex/main.tex

# Compile PDF
latexmk -pdf main.tex

# Move output
mv main.pdf /latex/output.pdf 