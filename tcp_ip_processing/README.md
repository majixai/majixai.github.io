# TCP/IP Processing

A Python + browser toolkit for capturing, parsing, and visualising TCP/IP
network traffic.

## Directory Structure

```
tcp_ip_processing/
├── main.py               # CLI entry point (capture / pcap / analyze / demo)
├── tcp_processor.py      # Packet capture & header parsing via scapy
├── packet_analyzer.py    # Statistics, flow tracking, protocol breakdown
├── requirements.txt      # Python dependencies
├── index.html            # Browser dashboard (PWA)
├── script.js             # Chart.js visualisation
├── style.css             # Dashboard styling
├── manifest.json         # PWA manifest
├── sw.js                 # Service worker (offline support)
└── data/                 # Auto-created at runtime
    ├── packets.json      # Raw parsed packets (written by tcp_processor.py)
    └── analysis.json     # Statistics (written by packet_analyzer.py)
```

## Features

- **Live capture** — uses [Scapy](https://scapy.net) to sniff packets on any
  interface (requires root/administrator privileges).
- **PCAP import** — parse an existing `.pcap` / `.pcapng` file without
  elevated privileges.
- **Header extraction** — IP (v4/v6) TTL, flags, IDs; TCP sequence/ack/flags/
  window; UDP length; ICMP type/code.
- **Rich statistics**
  - Protocol distribution
  - Top talkers (source IPs) and top listeners (destination IPs)
  - TCP flag breakdown
  - Well-known port → service name mapping
  - Packet-size histogram (7 buckets)
  - Per-second packet-rate timeline
  - Bidirectional connection/flow table (top 50 by bytes transferred)
- **Web dashboard** — PWA with Chart.js doughnut, bar, and line charts;
  sortable connection table; offline support via service worker.
- **Demo mode** — generates 500 synthetic packets so you can explore the
  dashboard without capturing real traffic.

## Quick Start

### 1 — Install Python dependencies

```bash
cd tcp_ip_processing
pip install -r requirements.txt
```

### 2 — Generate demo data (no root required)

```bash
python main.py demo
# Outputs: data/packets.json  and  data/analysis.json
```

### 3 — Open the dashboard

Serve the directory with any static HTTP server and open `index.html`:

```bash
# Python built-in server
python -m http.server 8000
# then visit http://localhost:8000/tcp_ip_processing/
```

## CLI Reference

```
python main.py <command> [options]
```

| Command | Description |
|---------|-------------|
| `demo [--count N]` | Generate N synthetic packets (default 500) and analyse |
| `capture [--iface IFACE] [--duration S] [--count N]` | Live capture (requires root) |
| `pcap <file>` | Parse a `.pcap` / `.pcapng` file |
| `analyze` | Re-run analysis on existing `data/packets.json` |

### Global options

| Option | Default | Description |
|--------|---------|-------------|
| `--packets PATH` | `data/packets.json` | Where to write/read raw packets |
| `--analysis PATH` | `data/analysis.json` | Where to write analysis results |

### Examples

```bash
# 60-second live capture on eth0
sudo python main.py capture --iface eth0 --duration 60

# Parse a Wireshark capture file
python main.py pcap ~/Downloads/capture.pcapng

# Re-run analysis after editing packets.json
python main.py analyze

# Quick demo run
python main.py demo --count 1000
```

## Module Reference

### `tcp_processor.py` — `PacketProcessor`

```python
from tcp_processor import PacketProcessor

p = PacketProcessor(output_path="data/packets.json")
p.capture(iface="eth0", duration=30)   # or p.read_pcap("file.pcap")
p.save()
```

### `packet_analyzer.py` — `PacketAnalyzer`

```python
import json
from packet_analyzer import PacketAnalyzer

with open("data/packets.json") as f:
    packets = json.load(f)

analyzer = PacketAnalyzer(packets)
result = analyzer.run()   # returns a dict with all statistics
```

`PacketAnalyzer` methods can also be called individually:

```python
analyzer.protocol_distribution()   # {"TCP": 312, "UDP": 98, ...}
analyzer.top_src_ips(n=5)
analyzer.tcp_flags_distribution()
analyzer.connection_table(limit=20)
analyzer.packet_rate_timeline()
analyzer.summary_stats()
```

## Data Format

### `data/packets.json`

A JSON array of packet records:

```json
[
  {
    "timestamp": "2026-04-10T12:00:00.123456+00:00",
    "protocol": "TCP",
    "length": 72,
    "src_ip": "192.168.1.10",
    "dst_ip": "93.184.216.34",
    "ip_version": 4,
    "ttl": 64,
    "ip_flags": "DF",
    "ip_id": 12345,
    "tos": 0,
    "src_port": 49152,
    "dst_port": 443,
    "tcp_seq": 1234567890,
    "tcp_ack": 987654321,
    "tcp_flags": "PA",
    "tcp_window": 65535,
    "tcp_urgptr": 0
  }
]
```

### `data/analysis.json`

```json
{
  "generated_at": "2026-04-10T12:01:00+00:00",
  "summary": { "total_packets": 500, "total_bytes": 385000, ... },
  "protocol_distribution": { "TCP": 312, "UDP": 98, "ICMP": 90 },
  "top_src_ips": [{ "ip": "192.168.1.10", "count": 120 }, ...],
  "top_dst_ips": [...],
  "top_dst_ports": [{ "port": 443, "service": "HTTPS", "count": 180 }, ...],
  "tcp_flags_distribution": { "PA": 200, "S": 60, ... },
  "packet_size_histogram": [{ "bucket": "0–64", "count": 40 }, ...],
  "packet_rate_timeline": [{ "time": "2026-04-10T12:00:00", "packets": 8 }, ...],
  "connection_table": [{ "src": "...", "dst": "...", "protocol": "TCP", "packets": 30, "bytes": 45000 }, ...]
}
```

## Notes

- **Privileges** — live packet capture with Scapy requires root on Linux/macOS
  or administrator rights on Windows. Reading PCAP files and running demo mode
  do not require elevated privileges.
- **Privacy** — captured data may contain sensitive network information. The
  `data/` directory is not committed to version control (add it to `.gitignore`
  as needed).
