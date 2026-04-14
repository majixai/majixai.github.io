/* global Chart, fetchAnalysis */
"use strict";

const DATA_URL = "data/analysis.json";

// ── Colour palette ──────────────────────────────────────────────────────────
const PROTO_COLORS = {
  TCP:   "#1a73e8",
  UDP:   "#34a853",
  ICMP:  "#fbbc04",
  ICMPv6:"#ff6d00",
  ARP:   "#ab47bc",
  OTHER: "#ea4335",
};

function protoColor(name) {
  return PROTO_COLORS[name] || "#9e9e9e";
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function fmt(n) {
  if (n === undefined || n === null) return "—";
  return Number(n).toLocaleString();
}

function fmtBytes(b) {
  if (b < 1024) return b + " B";
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + " KB";
  return (b / 1024 / 1024).toFixed(2) + " MB";
}

function el(id) { return document.getElementById(id); }

function setTile(id, value) {
  const t = el(id);
  if (t) t.textContent = value;
}

function badgeClass(proto) {
  const p = (proto || "").toUpperCase();
  if (p === "TCP")  return "badge badge-tcp";
  if (p === "UDP")  return "badge badge-udp";
  if (p === "ICMP") return "badge badge-icmp";
  return "badge badge-other";
}

// ── Chart helpers ───────────────────────────────────────────────────────────
function makePie(canvasId, labels, data) {
  const ctx = el(canvasId);
  if (!ctx) return;
  new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: labels.map(protoColor),
        borderWidth: 2,
        borderColor: "#fff",
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "right" },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${fmt(ctx.parsed)} pkts`,
          },
        },
      },
    },
  });
}

function makeBar(canvasId, labels, data, label, color) {
  const ctx = el(canvasId);
  if (!ctx) return;
  new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{ label, data, backgroundColor: color, borderRadius: 4 }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { maxRotation: 45, font: { size: 11 } } },
        y: { beginAtZero: true, ticks: { precision: 0 } },
      },
    },
  });
}

function makeLine(canvasId, labels, data) {
  const ctx = el(canvasId);
  if (!ctx) return;
  new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Packets / second",
        data,
        borderColor: "#1a73e8",
        backgroundColor: "rgba(26,115,232,.12)",
        fill: true,
        tension: 0.3,
        pointRadius: data.length > 100 ? 0 : 3,
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          ticks: {
            maxTicksLimit: 12,
            maxRotation: 45,
            font: { size: 10 },
          },
        },
        y: { beginAtZero: true, ticks: { precision: 0 } },
      },
    },
  });
}

// ── Connection table ─────────────────────────────────────────────────────────
function renderConnTable(rows) {
  const tbody = el("conn-tbody");
  if (!tbody || !rows) return;
  tbody.innerHTML = "";
  rows.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.src}</td>
      <td>${r.dst}</td>
      <td><span class="${badgeClass(r.protocol)}">${r.protocol}</span></td>
      <td>${fmt(r.packets)}</td>
      <td>${fmtBytes(r.bytes)}</td>`;
    tbody.appendChild(tr);
  });
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#999;padding:20px">No connections found</td></tr>';
  }
}

// ── Top-IP table ─────────────────────────────────────────────────────────────
function renderTopIpTable(tbodyId, rows, field) {
  const tbody = el(tbodyId);
  if (!tbody || !rows) return;
  tbody.innerHTML = "";
  rows.forEach((r, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${i + 1}</td><td>${r[field]}</td><td>${fmt(r.count)}</td>`;
    tbody.appendChild(tr);
  });
}

// ── Main render ──────────────────────────────────────────────────────────────
function renderDashboard(data) {
  // Summary tiles
  const s = data.summary || {};
  setTile("tile-total-packets",  fmt(s.total_packets));
  setTile("tile-total-bytes",    fmtBytes(s.total_bytes || 0));
  setTile("tile-avg-size",       fmt(s.avg_packet_size) + " B");
  setTile("tile-median-size",    fmt(s.median_packet_size) + " B");

  // Last updated
  if (data.generated_at) {
    const d = new Date(data.generated_at);
    el("last-updated").textContent = "Updated: " + d.toLocaleString();
  }

  // Protocol pie chart
  const pd = data.protocol_distribution || {};
  makePie("chart-proto", Object.keys(pd), Object.values(pd));

  // Packet-size histogram bar chart
  const hist = data.packet_size_histogram || [];
  makeBar(
    "chart-size-hist",
    hist.map(h => h.bucket),
    hist.map(h => h.count),
    "Packets",
    "#1a73e8"
  );

  // TCP flags bar chart
  const flags = data.tcp_flags_distribution || {};
  makeBar(
    "chart-tcp-flags",
    Object.keys(flags),
    Object.values(flags),
    "Count",
    "#34a853"
  );

  // Packet rate timeline
  const timeline = data.packet_rate_timeline || [];
  makeLine(
    "chart-rate",
    timeline.map(t => t.time.slice(11)),   // show HH:MM:SS
    timeline.map(t => t.packets)
  );

  // Top destination ports bar chart
  const ports = data.top_dst_ports || [];
  makeBar(
    "chart-ports",
    ports.map(p => p.service),
    ports.map(p => p.count),
    "Packets",
    "#fbbc04"
  );

  // Top source IPs table
  renderTopIpTable("src-ip-tbody", data.top_src_ips, "ip");

  // Top destination IPs table
  renderTopIpTable("dst-ip-tbody", data.top_dst_ips, "ip");

  // Connection table
  renderConnTable(data.connection_table);
}

// ── Bootstrap ────────────────────────────────────────────────────────────────
async function fetchAnalysis() {
  try {
    const resp = await fetch(DATA_URL);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    el("loading-banner").style.display = "none";
    el("dashboard").style.display = "";
    renderDashboard(data);
  } catch (err) {
    el("loading-banner").style.display = "none";
    const eb = el("error-banner");
    eb.textContent = "Could not load analysis data: " + err.message +
      ". Run `python main.py demo` to generate demo data.";
    eb.style.display = "block";
  }
}

document.addEventListener("DOMContentLoaded", fetchAnalysis);
