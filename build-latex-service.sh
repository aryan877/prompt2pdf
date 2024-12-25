#!/bin/bash
set -e

echo "Building LaTeX service Docker image..."
docker build -t latex-service -f Dockerfile.latex .

echo "Testing LaTeX service..."
TEST_DIR=$(mktemp -d)
mkdir -p "$TEST_DIR/content" "$TEST_DIR/output"

# Create a more comprehensive test document
cat > "$TEST_DIR/content/input.tex" << 'EOL'
\section{C++ Programming Examples}

\subsection{Fibonacci Recursion}
Here's a recursive implementation of the Fibonacci sequence:

\begin{lstlisting}[language=C++]
int fibonacci(int n) {
    // Base cases
    if (n <= 1) return n;
    
    // Recursive case
    return fibonacci(n - 1) + fibonacci(n - 2);
}
\end{lstlisting}

\subsection{Binary Tree Implementation}
A basic binary tree node implementation with traversal:

\begin{lstlisting}[language=C++]
struct TreeNode {
    int val;
    TreeNode* left;
    TreeNode* right;
    
    TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}
};

void inorderTraversal(TreeNode* root) {
    if (root == nullptr) return;
    
    inorderTraversal(root->left);
    std::cout << root->val << " ";
    inorderTraversal(root->right);
}
\end{lstlisting}

\subsection{Quick Sort Implementation}
Here's a quick sort algorithm implementation:

\begin{lstlisting}[language=C++]
void quickSort(vector<int>& arr, int low, int high) {
    if (low < high) {
        int pivot = partition(arr, low, high);
        quickSort(arr, low, pivot - 1);
        quickSort(arr, pivot + 1, high);
    }
}

int partition(vector<int>& arr, int low, int high) {
    int pivot = arr[high];
    int i = low - 1;
    
    for (int j = low; j < high; j++) {
        if (arr[j] <= pivot) {
            i++;
            swap(arr[i], arr[j]);
        }
    }
    swap(arr[i + 1], arr[high]);
    return i + 1;
}
\end{lstlisting}

\section{Mathematical Analysis}
The time complexity of these algorithms:

\begin{itemize}
    \item Fibonacci Recursive: $O(2^n)$
    \item Binary Tree Traversal: $O(n)$
    \item Quick Sort: $O(n \log n)$ average case
\end{itemize}

\section{Complexity Comparison}
Here's a comparison of different sorting algorithms:

\begin{table}[h]
\centering
\begin{tabular}{|l|c|c|c|}
\hline
Algorithm & Best Case & Average Case & Worst Case \\
\hline
Quick Sort & $O(n \log n)$ & $O(n \log n)$ & $O(n^2)$ \\
Merge Sort & $O(n \log n)$ & $O(n \log n)$ & $O(n \log n)$ \\
Bubble Sort & $O(n)$ & $O(n^2)$ & $O(n^2)$ \\
\hline
\end{tabular}
\end{table}
EOL

echo "Running Docker container..."
docker run --rm \
  -v "$TEST_DIR/content:/latex/content:ro" \
  -v "$TEST_DIR/output:/latex/output" \
  latex-service

if [ -f "$TEST_DIR/output/output.pdf" ]; then
  echo "✅ LaTeX service built and tested successfully!"
  echo "PDF generated at: $TEST_DIR/output/output.pdf"
  echo "You can view your PDF at: $TEST_DIR/output/output.pdf"
  # Uncomment the following line if you want to auto-open the PDF
  open "$TEST_DIR/output/output.pdf"  # For macOS
  # xdg-open "$TEST_DIR/output/output.pdf"  # For Linux
else
  echo "❌ LaTeX service test failed!"
  echo "Contents of test directory:"
  ls -la "$TEST_DIR"
  echo "Docker logs:"
  docker logs $(docker ps -lq)
  rm -rf "$TEST_DIR"
  exit 1
fi 