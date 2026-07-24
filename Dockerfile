FROM ubuntu:22.04
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    curl \
    wget \
    gnupg \
    libcap2-bin \
    procps \
    ca-certificates \
    python3 \
    socat \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .

RUN dpkg -i flussonic-erlang_25.3.3_all.deb || apt-get install -y -f
RUN dpkg -i flussonic-transcoder-base_23.02.0_all.deb || apt-get install -y -f
RUN dpkg -i flussonic-transcoder_23.02.0_all.deb || apt-get install -y -f
RUN dpkg -i flussonic-qsv_23.02.7_all.deb || apt-get install -y -f
RUN dpkg -i flussonic_23.09_all.deb || apt-get install -y -f

RUN rm *.deb
RUN mkdir -p /etc/flussonic/ /var/lib/flussonic
RUN chmod +x /app/start.sh

EXPOSE 80 1935

CMD ["/app/start.sh"]
