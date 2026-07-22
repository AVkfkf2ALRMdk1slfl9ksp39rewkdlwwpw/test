FROM node:20-slim

# Install ffmpeg for video processing and transcoding
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy package files and install
COPY package.json ./
RUN npm install

# Copy source code
COPY . .

# Create runtime directories
RUN mkdir -p uploads/videos uploads/thumbnails uploads/recordings \
    public/uploads/public/uploads/videos public/uploads/thumbnails public/uploads/recordings \
    server/data server/logs

# Set environment variables
ENV PORT=3000
ENV NODE_ENV=production
ENV RTMP_PORT=1935
ENV ADMIN_USER=admin
ENV ADMIN_PASS=admin

# Expose ports (HTTP + RTMP)
EXPOSE 3000 1935

# Start the application
CMD ["node", "server/index.js"]
