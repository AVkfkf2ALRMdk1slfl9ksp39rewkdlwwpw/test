dpkg -i *.deb
mkdir -p /etc/flussonic/
cat > /etc/flussonic/flussonic.conf <<EOF
# Global settings:
http 80;
rtmp 1935;
pulsedb /var/lib/flussonic;
session_log /var/lib/flussonic;
edit_auth admin admin;
# DVRs:
# Remote sources:
# Balancer:
# Stream templates:
# Ingest streams:
# Disk file caches:
# VOD locations:
# DVB cards:
# Components:
iptv;
EOF
