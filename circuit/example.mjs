import router from '/router/router.js';
import { hashRoute, sha256 } from '/hash/hash.js';

const output = document.getElementById('output');

const exampleCircuit = {
  name: 'circuit',
  path: '/circuit/',
  board: 'ESP32-P4',
  asicChain: 8,
  controlLinks: ['UART', 'Wi-Fi', 'GPIO'],
  notes: ['flash recovery', 'timing discipline', 'thermal monitoring'],
};

function render(lines) {
  if (!output) return;
  output.textContent = lines.join('\n');
}

async function main() {
  await router.ready();
  const routeDigest = await hashRoute({ path: '/circuit/', name: 'circuit' });
  const circuitDigest = await sha256(JSON.stringify(exampleCircuit));

  render([
    'Circuit example script',
    '----------------------',
    `Route hash: ${routeDigest}`,
    `Example circuit hash: ${circuitDigest}`,
    '',
    'Example circuit payload:',
    JSON.stringify(exampleCircuit, null, 2),
  ]);
}

main().catch((error) => {
  render(['Circuit example script', '----------------------', `Error: ${error.message}`]);
});
