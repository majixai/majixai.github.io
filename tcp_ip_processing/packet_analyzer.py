"""
TCP/IP Packet Analyzer

Reads the JSON file produced by tcp_processor.py and computes rich statistics:
  - Protocol distribution
  - Top talkers (source IPs) and listeners (destination IPs)
  - TCP flag distribution
  - Well-known port service mapping
  - Packet-size histogram
  - Temporal packet-rate timeline (packets per second)
  - Active connection tracking (src_ip:src_port ↔ dst_ip:dst_port)
  - Flow summary (bidirectional streams)

Results are written to data/analysis.json for consumption by the web dashboard.

Usage:
    python packet_analyzer.py [--input data/packets.json] [--output data/analysis.json]
"""

import json
import logging
import argparse
import statistics
from pathlib import Path
from collections import Counter, defaultdict
from datetime import datetime, timezone

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

DEFAULT_INPUT = Path(__file__).parent / "data" / "packets.json"
DEFAULT_OUTPUT = Path(__file__).parent / "data" / "analysis.json"

# Common port → service name mapping
PORT_SERVICES: dict[int, str] = {
    20: "FTP-data", 21: "FTP", 22: "SSH", 23: "Telnet",
    25: "SMTP", 53: "DNS", 67: "DHCP", 68: "DHCP",
    80: "HTTP", 110: "POP3", 143: "IMAP", 443: "HTTPS",
    465: "SMTPS", 587: "SMTP-TLS", 993: "IMAPS", 995: "POP3S",
    3306: "MySQL", 5432: "PostgreSQL", 6379: "Redis",
    8080: "HTTP-Alt", 8443: "HTTPS-Alt", 27017: "MongoDB",
}

SIZE_BUCKETS = [
    (0, 64),
    (65, 128),
    (129, 256),
    (257, 512),
    (513, 1024),
    (1025, 1500),
    (1501, float("inf")),
]


def _bucket_label(lo: int, hi) -> str:
    return f"{lo}–{hi}" if hi != float("inf") else f"{lo}+"


def _service(port: int | None) -> str:
    if port is None:
        return "Unknown"
    return PORT_SERVICES.get(port, str(port))


def _flow_key(rec: dict) -> tuple:
    """Canonical (sorted) 4-tuple so A→B and B→A map to the same flow."""
    a = (rec.get("src_ip", ""), rec.get("src_port", 0))
    b = (rec.get("dst_ip", ""), rec.get("dst_port", 0))
    return (min(a, b), max(a, b))


class PacketAnalyzer:
    """Compute statistics over a list of parsed packet records."""

    def __init__(self, packets: list[dict]):
        self.packets = packets

    # ------------------------------------------------------------------
    # Individual metric methods
    # ------------------------------------------------------------------

    def protocol_distribution(self) -> dict[str, int]:
        return dict(Counter(p.get("protocol", "OTHER") for p in self.packets))

    def top_src_ips(self, n: int = 10) -> list[dict]:
        c = Counter(p.get("src_ip", "") for p in self.packets if p.get("src_ip"))
        return [{"ip": ip, "count": cnt} for ip, cnt in c.most_common(n)]

    def top_dst_ips(self, n: int = 10) -> list[dict]:
        c = Counter(p.get("dst_ip", "") for p in self.packets if p.get("dst_ip"))
        return [{"ip": ip, "count": cnt} for ip, cnt in c.most_common(n)]

    def top_dst_ports(self, n: int = 10) -> list[dict]:
        c = Counter(p.get("dst_port") for p in self.packets if p.get("dst_port") is not None)
        return [
            {"port": port, "service": _service(port), "count": cnt}
            for port, cnt in c.most_common(n)
        ]

    def tcp_flags_distribution(self) -> dict[str, int]:
        c: Counter = Counter()
        for p in self.packets:
            if p.get("protocol") == "TCP" and p.get("tcp_flags"):
                c[p["tcp_flags"]] += 1
        return dict(c)

    def packet_size_histogram(self) -> list[dict]:
        hist = [{
            "bucket": _bucket_label(lo, hi),
            "count": 0,
        } for lo, hi in SIZE_BUCKETS]
        for p in self.packets:
            length = p.get("length", 0)
            for i, (lo, hi) in enumerate(SIZE_BUCKETS):
                if lo <= length <= hi:
                    hist[i]["count"] += 1
                    break
        return hist

    def packet_rate_timeline(self) -> list[dict]:
        """Aggregate packet counts by second."""
        per_second: Counter = Counter()
        for p in self.packets:
            ts_str = p.get("timestamp", "")
            if ts_str:
                try:
                    ts = datetime.fromisoformat(ts_str)
                    key = ts.strftime("%Y-%m-%dT%H:%M:%S")
                    per_second[key] += 1
                except ValueError:
                    pass
        return [{"time": t, "packets": c} for t, c in sorted(per_second.items())]

    def connection_table(self, limit: int = 50) -> list[dict]:
        """Return per-flow byte/packet counts (up to *limit* flows)."""
        flows: dict[tuple, dict] = defaultdict(
            lambda: {"packets": 0, "bytes": 0, "protocol": ""}
        )
        for p in self.packets:
            key = _flow_key(p)
            flows[key]["packets"] += 1
            flows[key]["bytes"] += p.get("length", 0)
            if not flows[key]["protocol"]:
                flows[key]["protocol"] = p.get("protocol", "")

        result = []
        for (a, b), stats in flows.items():
            result.append(
                {
                    "src": f"{a[0]}:{a[1]}",
                    "dst": f"{b[0]}:{b[1]}",
                    "protocol": stats["protocol"],
                    "packets": stats["packets"],
                    "bytes": stats["bytes"],
                }
            )
        result.sort(key=lambda x: x["bytes"], reverse=True)
        return result[:limit]

    def summary_stats(self) -> dict:
        n = len(self.packets)
        if n == 0:
            return {"total_packets": 0}
        sizes = [p.get("length", 0) for p in self.packets]
        return {
            "total_packets": n,
            "total_bytes": sum(sizes),
            "avg_packet_size": round(statistics.mean(sizes), 2),
            "median_packet_size": round(statistics.median(sizes), 2),
            "min_packet_size": min(sizes),
            "max_packet_size": max(sizes),
        }

    # ------------------------------------------------------------------
    # Orchestration
    # ------------------------------------------------------------------

    def run(self) -> dict:
        logger.info("Analyzing %d packets …", len(self.packets))
        return {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "summary": self.summary_stats(),
            "protocol_distribution": self.protocol_distribution(),
            "top_src_ips": self.top_src_ips(),
            "top_dst_ips": self.top_dst_ips(),
            "top_dst_ports": self.top_dst_ports(),
            "tcp_flags_distribution": self.tcp_flags_distribution(),
            "packet_size_histogram": self.packet_size_histogram(),
            "packet_rate_timeline": self.packet_rate_timeline(),
            "connection_table": self.connection_table(),
        }


def _build_arg_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="Analyze captured TCP/IP packet data.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    p.add_argument("--input", default=str(DEFAULT_INPUT), help="Packets JSON file")
    p.add_argument("--output", default=str(DEFAULT_OUTPUT), help="Analysis output JSON file")
    return p


def main():
    args = _build_arg_parser().parse_args()
    input_path = Path(args.input)
    output_path = Path(args.output)

    if not input_path.exists():
        logger.error("Input file not found: %s", input_path)
        raise SystemExit(1)

    with input_path.open(encoding="utf-8") as fh:
        packets = json.load(fh)

    analyzer = PacketAnalyzer(packets)
    analysis = analyzer.run()

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as fh:
        json.dump(analysis, fh, indent=2)

    logger.info("Analysis saved → %s", output_path)


if __name__ == "__main__":
    main()
