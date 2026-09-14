// Administrative aggregate report; never prints actor keys, identities or content.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url); require('dotenv').config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });
const { PrismaClient } = require('@prisma/client'); const { summarizeDiagnostics } = require('../dist/diagnostics/diagnostics-contract.js'); const prisma = new PrismaClient();
try { const events = await prisma.diagnosticsEvent.findMany({ where: { occurredAt: { gte: new Date(Date.now() - 30 * 86400000) } }, select: { actorKey: true, name: true, occurredAt: true } }); console.log(JSON.stringify(summarizeDiagnostics(events), null, 2)); }
catch { console.error('Could not read diagnostic aggregates. Check the server database configuration and migration.'); process.exitCode = 1; }
finally { await prisma.$disconnect(); }
