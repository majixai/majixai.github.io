"""
TCP/IP Processing — CLI Entry Point

Modes
-----
capture   Capture live packets, then run analysis.
pcap      Parse a PCAP file, then run analysis.
analyze   Run analysis only (packets.json must already exist).
demo      Generate synthetic demo data and run analysis.

Examples
--------
# Live capture for 30 s on eth0, save results
sudo python main.py capture --iface eth0 --duration 30

# Parse a PCAP file
python main.py pcap capture.pcap

# Re-analyze previously captured packets
python main.py analyze

# Generate demo data (no root required)
python main.py demo
"""

import json
import logging
import argparse
import random
from datetime import datetime, timezone, timedelta
from pathlib import Path

# Lazy imports — only resolved when the relevant sub-command is invoked.
# This keeps demo/analyze modes runnable without scapy installed.
_PACKETS_JSON = Path(__file__).parent / "data" / "packets.json"
_ANALYSIS_JSON = Path(__file__).parent / "data" / "analysis.json"


def _load_processor():
    from tcp_processor import PacketProcessor, DEFAULT_OUTPUT as PACKETS_JSON  # noqa: F401
    return PacketProcessor


def _load_analyzer():
    from packet_analyzer import PacketAnalyzer, DEFAULT_OUTPUT as ANALYSIS_JSON  # noqa: F401
    return PacketAnalyzer

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

_DEMO_PROTOCOLS = ["TCP", "TCP", "TCP", "UDP", "ICMP", "TCP", "UDP"]
_DEMO_FLAGS = ["S", "SA", "A", "FA", "R", "PA", "F"]
_DEMO_PORTS = [80, 443, 22, 53, 8080, 3306, 5432, 6379, 27017, 443, 80]

_RFC1918 = [
    "192.168.1.{}",
    "10.0.0.{}",
    "172.16.0.{}",
]


def _rand_ip():
    tpl = random.choice(_RFC1918)
    return tpl.format(random.randint(1, 254))


def _rand_public_ip():
    return ".".join(str(random.randint(1, 254)) for _ in range(4))


def _generate_demo_packets(n: int = 500) -> list[dict]:
    """Create *n* synthetic packet records that exercise all analysis paths."""
    base_time = datetime.now(timezone.utc) - timedelta(minutes=5)
    records = []

    src_pool = [_rand_ip() for _ in range(8)]
    dst_pool = [_rand_public_ip() for _ in range(6)]

    for i in range(n):
        proto = random.choice(_DEMO_PROTOCOLS)
        src_ip = random.choice(src_pool)
        dst_ip = random.choice(dst_pool)
        ts = (base_time + timedelta(seconds=i * 0.6)).isoformat()
        length = random.choices(
            [random.randint(40, 64),
             random.randint(64, 256),
             random.randint(256, 1024),
             random.randint(1024, 1500)],
            weights=[20, 40, 30, 10],
        )[0]

        rec: dict = {
            "timestamp": ts,
            "protocol": proto,
            "length": length,
            "src_ip": src_ip,
            "dst_ip": dst_ip,
            "ip_version": 4,
            "ttl": random.randint(32, 128),
            "ip_flags": random.choice(["DF", ""]),
            "ip_id": random.randint(0, 65535),
            "tos": 0,
        }

        if proto == "TCP":
            src_port = random.randint(1024, 65535)
            dst_port = random.choice(_DEMO_PORTS)
            rec.update(
                {
                    "src_port": src_port,
                    "dst_port": dst_port,
                    "tcp_seq": random.randint(0, 2**32 - 1),
                    "tcp_ack": random.randint(0, 2**32 - 1),
                    "tcp_flags": random.choice(_DEMO_FLAGS),
                    "tcp_window": random.randint(1024, 65535),
                    "tcp_urgptr": 0,
                }
            )
        elif proto == "UDP":
            rec.update(
                {
                    "src_port": random.randint(1024, 65535),
                    "dst_port": random.choice([53, 67, 123, 5353]),
                    "udp_len": length,
                }
            )
        elif proto == "ICMP":
            rec.update(
                {
                    "icmp_type": random.choice([0, 8, 3, 11]),
                    "icmp_code": 0,
                }
            )

        records.append(rec)

    return records


# ---------------------------------------------------------------------------
# Sub-command handlers
# ---------------------------------------------------------------------------

def cmd_capture(args):
    PacketProcessor = _load_processor()
    processor = PacketProcessor(output_path=args.packets)
    processor.capture(iface=args.iface, duration=args.duration, count=args.count)
    processor.save()
    _run_analysis(args.packets, args.analysis)


def cmd_pcap(args):
    PacketProcessor = _load_processor()
    processor = PacketProcessor(output_path=args.packets)
    processor.read_pcap(args.file)
    processor.save()
    _run_analysis(args.packets, args.analysis)


def cmd_analyze(args):
    _run_analysis(args.packets, args.analysis)


def cmd_demo(args):
    logger.info("Generating %d synthetic demo packets …", args.count)
    records = _generate_demo_packets(args.count)
    out = Path(args.packets)
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8") as fh:
        json.dump(records, fh, indent=2)
    logger.info("Demo packets saved → %s", out)
    _run_analysis(args.packets, args.analysis)


def _run_analysis(packets_path, analysis_path):
    PacketAnalyzer = _load_analyzer()
    p = Path(packets_path)
    if not p.exists():
        logger.error("Packets file not found: %s", p)
        raise SystemExit(1)
    with p.open(encoding="utf-8") as fh:
        packets = json.load(fh)
    analyzer = PacketAnalyzer(packets)
    result = analyzer.run()
    out = Path(analysis_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8") as fh:
        json.dump(result, fh, indent=2)
    logger.info("Analysis saved → %s", out)


# ---------------------------------------------------------------------------
# Argument parser
# ---------------------------------------------------------------------------

def _build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="tcp_ip_processing",
        description="TCP/IP packet capture and analysis toolkit.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    p.add_argument("--packets", default=str(_PACKETS_JSON), help="Packets JSON path")
    p.add_argument("--analysis", default=str(_ANALYSIS_JSON), help="Analysis JSON path")

    subs = p.add_subparsers(dest="command", required=True)

    # capture
    c = subs.add_parser("capture", help="Live packet capture then analyze")
    c.add_argument("--iface", default=None, help="Network interface (default: auto)")
    c.add_argument("--duration", type=int, default=60, help="Capture duration (seconds)")
    c.add_argument("--count", type=int, default=0, help="Max packets (0=unlimited)")
    c.set_defaults(func=cmd_capture)

    # pcap
    pc = subs.add_parser("pcap", help="Parse a PCAP file then analyze")
    pc.add_argument("file", help="Path to .pcap / .pcapng file")
    pc.set_defaults(func=cmd_pcap)

    # analyze
    an = subs.add_parser("analyze", help="Analyze existing packets.json")
    an.set_defaults(func=cmd_analyze)

    # demo
    dm = subs.add_parser("demo", help="Generate synthetic demo data and analyze")
    dm.add_argument("--count", type=int, default=500, help="Number of demo packets")
    dm.set_defaults(func=cmd_demo)

    return p


def main():
    parser = _build_parser()
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
