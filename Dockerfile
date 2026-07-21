FROM debian:bullseye-slim

# Install dependencies
RUN apt-get update && apt-get install -y \
    libssl1.1 \
    libncurses5 \
    libncurses6 \
    && rm -rf /var/lib/apt/lists/*

# Copy all .deb files and install script
COPY *.deb /tmp/
COPY install.sh /tmp/install.sh

# Install Flussonic packages
RUN cd /tmp && bash install.sh && rm -rf /tmp/*

# Set environment
ENV PORT=80

# Expose ports
EXPOSE 80 1935 8080

# Start Flussonic
CMD ["flussonic"]
