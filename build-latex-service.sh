#!/bin/bash
set -e

export DEBIAN_FRONTEND=noninteractive
export TZ=Etc/UTC

echo "Building LaTeX service Docker image..."
docker build -t latex-service -f Dockerfile.latex .

echo "Testing LaTeX service..."
TEST_DIR=$(mktemp -d)
mkdir -p "$TEST_DIR/content" "$TEST_DIR/output"

# Simple doc
cat > "$TEST_DIR/content/doc.tex" << 'EOF'
\documentclass{article}
\usepackage{amsmath,amssymb}
\usepackage[margin=1in]{geometry}

\begin{document}

\section*{Test}
Hello from inside Docker!

\end{document}
EOF

docker run --rm \
  -v "$TEST_DIR/content:/latex/content:ro" \
  -v "$TEST_DIR/output:/latex/output" \
  latex-service

if [ -f "$TEST_DIR/output/output.pdf" ]; then
  echo "✅ Success!"
  echo "PDF at: $TEST_DIR/output/output.pdf"
else
  echo "❌ Failed!"
  ls -la "$TEST_DIR/output"
  exit 1
fi
