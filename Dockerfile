FROM debian:bullseye-slim

ENV DEBIAN_FRONTEND=noninteractive

# Install only essential deps that the erlang binary needs
# Flussonic bundles its own libssl.so.1.1 and libcrypto.so.1.1
RUN apt-get update --fix-missing && apt-get install -y --no-install-recommends \
    libc6 \
    libstdc++6 \
    libgcc-s1 \
    libncurses6 \
    libtinfo6 \
    dpkg \
    bash \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy all .deb files and install script
COPY *.deb /tmp/
COPY install.sh /tmp/install.sh

# Install Flussonic packages
RUN cd /tmp && bash install.sh && rm -rf /tmp/*.deb /tmp/install.sh

# Create required directories
RUN mkdir -p /etc/flussonic /var/lib/flussonic /var/log/flussonic /var/run/flussonic

# Set environment
ENV PORT=80
ENV PROD=true
ENV DO_NOT_DO_NET_TUNING=yes

# Expose ports
EXPOSE 80 1935 8080 8443

# Start Flussonic in production mode with -noinput
CMD ["/opt/flussonic/bin/run", "-noinput", "-c", "/etc/flussonic/flussonic.conf"]
