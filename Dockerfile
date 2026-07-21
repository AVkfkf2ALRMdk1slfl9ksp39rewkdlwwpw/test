FROM node:20-slim

# Install ffmpeg for video processing
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install

# Copy all source files
COPY . .

# Create required directories
RUN mkdir -p uploads/videos uploads/thumbnails

# Set environment
ENV PORT=3000
ENV NODE_ENV=production

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "server/index.js"]
