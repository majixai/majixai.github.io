"""
TCP/IP Packet Processor

Captures live network packets (or reads a PCAP file) and extracts
IP/TCP/UDP/ICMP header fields, writing timestamped records to
data/packets.json for downstream analysis.

Requires root/administrator privileges for live capture.

Usage:
    # Live capture for 60 seconds on any interface
    sudo python tcp_processor.py --duration 60

    # Read an existing PCAP file
    python tcp_processor.py --pcap path/to/file.pcap

    # Specify interface and output file
    sudo python tcp_processor.py --iface eth0 --duration 30 --output data/packets.json
"""

import json
import logging
import argparse
from pathlib import Path
from datetime import datetime, timezone

from scapy.all import (
    sniff, rdpcap,
    IP, IPv6, TCP, UDP, ICMP, ICMPv6EchoRequest, ICMPv6EchoReply,
    Ether, ARP,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

DEFAULT_OUTPUT = Path(__file__).parent / "data" / "packets.json"


def _protocol_name(pkt) -> str:
    """Return a human-readable protocol label for a packet."""
    if pkt.haslayer(TCP):
        return "TCP"
    if pkt.haslayer(UDP):
        return "UDP"
    if pkt.haslayer(ICMP):
        return "ICMP"
    if pkt.haslayer(ICMPv6EchoRequest) or pkt.haslayer(ICMPv6EchoReply):
        return "ICMPv6"
    if pkt.haslayer(ARP):
        return "ARP"
    return "OTHER"


def _parse_packet(pkt) -> dict | None:
    """Extract header fields from a scapy packet into a plain dict."""
    record: dict = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "protocol": _protocol_name(pkt),
        "length": len(pkt),
    }

    # Layer 3 — IP / IPv6
    if pkt.haslayer(IP):
        ip = pkt[IP]
        record.update(
            {
                "src_ip": ip.src,
                "dst_ip": ip.dst,
                "ip_version": 4,
                "ttl": ip.ttl,
                "ip_flags": str(ip.flags),
                "ip_id": ip.id,
                "tos": ip.tos,
            }
        )
    elif pkt.haslayer(IPv6):
        ip6 = pkt[IPv6]
        record.update(
            {
                "src_ip": ip6.src,
                "dst_ip": ip6.dst,
                "ip_version": 6,
                "ttl": ip6.hlim,
                "ip_flags": "",
                "ip_id": 0,
                "tos": 0,
            }
        )
    else:
        return None  # skip non-IP packets (e.g. raw ARP without IP)

    # Layer 4 — TCP
    if pkt.haslayer(TCP):
        tcp = pkt[TCP]
        record.update(
            {
                "src_port": tcp.sport,
                "dst_port": tcp.dport,
                "tcp_seq": tcp.seq,
                "tcp_ack": tcp.ack,
                "tcp_flags": str(tcp.flags),
                "tcp_window": tcp.window,
                "tcp_urgptr": tcp.urgptr,
            }
        )
    # Layer 4 — UDP
    elif pkt.haslayer(UDP):
        udp = pkt[UDP]
        record.update(
            {
                "src_port": udp.sport,
                "dst_port": udp.dport,
                "udp_len": udp.len,
            }
        )
    # Layer 4 — ICMP
    elif pkt.haslayer(ICMP):
        icmp = pkt[ICMP]
        record.update(
            {
                "icmp_type": icmp.type,
                "icmp_code": icmp.code,
            }
        )

    return record


class PacketProcessor:
    """Capture or read packets and store parsed records."""

    def __init__(self, output_path: Path = DEFAULT_OUTPUT):
        self.output_path = Path(output_path)
        self.output_path.parent.mkdir(parents=True, exist_ok=True)
        self.records: list[dict] = []

    def _handle(self, pkt) -> None:
        record = _parse_packet(pkt)
        if record:
            self.records.append(record)

    def capture(self, iface: str | None = None, duration: int = 60, count: int = 0) -> int:
        """
        Capture live packets.

        Args:
            iface:    Network interface (None = auto-detect).
            duration: How many seconds to capture (0 = unlimited).
            count:    Max packets to capture (0 = unlimited).

        Returns:
            Number of packets captured.
        """
        logger.info(
            "Starting live capture — iface=%s, duration=%ss, count=%s",
            iface or "any",
            duration or "∞",
            count or "∞",
        )
        kwargs: dict = {"prn": self._handle, "store": False}
        if iface:
            kwargs["iface"] = iface
        if duration:
            kwargs["timeout"] = duration
        if count:
            kwargs["count"] = count

        sniff(**kwargs)
        logger.info("Capture finished. %d packets recorded.", len(self.records))
        return len(self.records)

    def read_pcap(self, pcap_path: str) -> int:
        """
        Read packets from a PCAP file.

        Args:
            pcap_path: Path to .pcap / .pcapng file.

        Returns:
            Number of packets parsed.
        """
        logger.info("Reading PCAP: %s", pcap_path)
        pkts = rdpcap(pcap_path)
        for pkt in pkts:
            self._handle(pkt)
        logger.info("Read %d packets from PCAP.", len(self.records))
        return len(self.records)

    def save(self) -> Path:
        """Write parsed records to the output JSON file."""
        with self.output_path.open("w", encoding="utf-8") as fh:
            json.dump(self.records, fh, indent=2)
        logger.info("Saved %d records → %s", len(self.records), self.output_path)
        return self.output_path


def _build_arg_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="Capture and parse TCP/IP packets.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    src = p.add_mutually_exclusive_group()
    src.add_argument("--pcap", metavar="FILE", help="Read from a PCAP file instead of live capture")
    src.add_argument("--iface", metavar="IFACE", help="Network interface for live capture")
    p.add_argument("--duration", type=int, default=60, help="Live capture duration in seconds (0=unlimited)")
    p.add_argument("--count", type=int, default=0, help="Max packets to capture (0=unlimited)")
    p.add_argument("--output", default=str(DEFAULT_OUTPUT), help="Output JSON file path")
    return p


def main():
    args = _build_arg_parser().parse_args()
    processor = PacketProcessor(output_path=args.output)

    if args.pcap:
        processor.read_pcap(args.pcap)
    else:
        processor.capture(iface=args.iface, duration=args.duration, count=args.count)

    processor.save()


if __name__ == "__main__":
    main()
