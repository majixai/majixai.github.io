import router from '/router/router.js';
import { hashRoute, sha256 } from '/hash/hash.js';

const output = document.getElementById('output');

const exampleJob = {
  name: 'mining',
  path: '/mining/',
  blockHeight: 0,
  nonceWindow: 1024,
  target: '0x00000fffff000000000000000000000000000000000000000000000000000000',
};

function render(lines) {
  if (!output) return;
  output.textContent = lines.join('\n');
}

async function main() {
  await router.ready();
  const routeDigest = await hashRoute({ path: '/mining/', name: 'mining' });
  const jobDigest = await sha256(JSON.stringify(exampleJob));

  render([
    'Mining example script',
    '---------------------',
    `Route hash: ${routeDigest}`,
    `Example job hash: ${jobDigest}`,
    '',
    'Example job payload:',
    JSON.stringify(exampleJob, null, 2),
  ]);
}

main().catch((error) => {
  render(['Mining example script', '---------------------', `Error: ${error.message}`]);
});
