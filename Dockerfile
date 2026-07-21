FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Install dependencies
RUN apt-get update --fix-missing && apt-get install -y \
    libssl3 \
    libncurses6 \
    dpkg \
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

# Start Flussonic in foreground
CMD ["/opt/flussonic/bin/run"]
