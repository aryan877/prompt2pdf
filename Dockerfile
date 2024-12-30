FROM node:18-slim

# Install LaTeX dependencies
ARG DEBIAN_FRONTEND=noninteractive
ENV TZ=Etc/UTC

RUN apt-get update && apt-get install -y \
    texlive-latex-base \
    texlive-latex-recommended \
    texlive-latex-extra \
    texlive-fonts-recommended \
    texlive-science \
    latexmk \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with --force
RUN npm install --force

# Copy the rest of the application
COPY . .

# Create LaTeX working directory
RUN mkdir -p /latex/work

# Expose both the main port and webpack HMR port
EXPOSE 3000 3001

# Use environment variable to control the startup command
ENV NODE_ENV=production
CMD if [ "$NODE_ENV" = "development" ]; then \
        npm run dev -- -p 3000; \
    else \
        npm run build && npm start; \
    fi