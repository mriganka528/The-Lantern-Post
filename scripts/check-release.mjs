// Local inventory only. Never loads credentials, contacts a provider or publishes.
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { policies, minimumAge, publisherName } from '../client/src/legal/policies.ts';
const root = new URL('../', import.meta.url);
const exists = async path => { try { await access(new URL(path, root)); return true; } catch { return false; } };
const source = await readFile(new URL('client/src/storybook/palace-scene.tsx', root), 'utf8');
const checks = [
  { item: 'Bundled palace scene has no flock layer', status: !/FlyingDoves|flying-dove/.test(source) ? 'ready' : 'missing' },
  { item: 'Review policy text and minimum age', status: publisherName === 'The Lantern Post' && minimumAge === 13 && policies.privacy.sections.length > 0 ? 'ready' : 'missing' },
  { item: 'Browser rehearsal artifact present (inspect its date and rerun after changes)', status: await exists('.cache/phase11-review/browser-checks.json') ? 'ready' : 'missing' },
  { item: 'HTTP load rehearsal report present (isolated fixture)', status: await exists('.cache/phase11-review/infinity-http-load.json') ? 'ready' : 'missing' },
  { item: 'PostgreSQL load report present (dedicated database)', status: await exists('.cache/phase11-review/infinity-postgres-load.json') ? 'ready' : 'pending' },
  { item: 'All-platform JavaScript export metadata present', status: await exists('client/dist/phase11/metadata.json') ? 'ready' : 'pending' },
  { item: 'Legal operator, country, contact, provider regions and finalized policies', status: 'pending' },
  { item: 'Account erasure and privacy request handling reviewed before launch', status: 'pending' },
  { item: 'Automated moderation and administrator review: optional later update', status: 'deferred' },
  { item: 'Live storage, backups, retention and restore rehearsal', status: 'deferred' },
  { item: 'Native image/audio sharing: real device verification', status: 'pending' },
  { item: 'Android/iOS internal testing, EAS/Firebase and store submission', status: 'deferred' },
];
const report = { checkedAt: new Date().toISOString(), mode: 'Local inventory, not approval to launch. A present artifact does not prove it matches the latest source.', publisherName, minimumAge, publicLaunchReady: false, checks };
await mkdir(new URL('.cache/phase11-review/', root), { recursive: true }); await writeFile(new URL('.cache/phase11-review/release-inventory.json', root), JSON.stringify(report, null, 2) + '\n');
for (const check of checks) console.log(`${check.status.toUpperCase().padEnd(8)} ${check.item}`);
console.log('Product development can continue. Public launch is still deferred.');
if (process.argv.includes('--strict')) process.exitCode = 1;
