FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Install necessary system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    gnupg \
    libcap2-bin \
    procps \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .

# Install the provided .deb packages in order of dependency
RUN dpkg -i flussonic-erlang_25.3.3_all.deb || apt-get install -y -f
RUN dpkg -i flussonic-transcoder-base_23.02.0_all.deb || apt-get install -y -f
RUN dpkg -i flussonic-transcoder_23.02.0_all.deb || apt-get install -y -f
RUN dpkg -i flussonic-qsv_23.02.7_all.deb || apt-get install -y -f
RUN dpkg -i flussonic_23.09_all.deb || apt-get install -y -f

# Clean up deb files to reduce image size
RUN rm *.deb

# Prepare configuration directory
RUN mkdir -p /etc/flussonic/

# Create a startup script to handle the dynamic PORT provided by Railway
RUN echo '#!/bin/bash\n\
PORT_TO_USE=${PORT:-80}\n\
echo "http $PORT_TO_USE;" > /etc/flussonic/flussonic.conf\n\
echo "rtmp 1935;" >> /etc/flussonic/flussonic.conf\n\
echo "pulsedb /var/lib/flussonic;" >> /etc/flussonic/flussonic.conf\n\
echo "session_log /var/lib/flussonic;" >> /etc/flussonic/flussonic.conf\n\
echo "edit_auth admin admin;" >> /etc/flussonic/flussonic.conf\n\
echo "iptv;" >> /etc/flussonic/flussonic.conf\n\
\n\
exec /opt/flussonic/bin/run' > /app/start.sh

RUN chmod +x /app/start.sh

# Expose default ports
EXPOSE 80 1935

CMD ["/app/start.sh"]
