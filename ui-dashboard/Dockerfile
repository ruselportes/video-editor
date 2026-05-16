FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose Vite's default port
EXPOSE 5173

# Start Vite dev server exposing to all network interfaces
CMD ["npx", "vite", "--host", "0.0.0.0", "--port", "5173"]
