// Audit des dépendances avant une publication (OWASP ASVS 15.1.1 / 15.2.1).
// Bloque si une faille haute ou critique n'est pas corrigée ET n'a pas d'exception documentée
// et encore valide dans security/audit-exceptions.json. Les failles basses / moyennes sont affichées.
// Usage : node scripts/audit.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const EXCEPTIONS_FILE = new URL('../security/audit-exceptions.json', import.meta.url);
const BLOCKING = new Set(['high', 'critical']);

let report;
try {
  report = execFileSync('npm', ['audit', '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
} catch (e) {
  // npm audit sort en erreur dès qu'il trouve une faille : le rapport est quand même sur stdout
  report = e.stdout;
}
if (!report) {
  console.error('npm audit n’a rien renvoyé (pas de réseau ?). Audit impossible : publication bloquée.');
  process.exit(1);
}

const exceptions = JSON.parse(readFileSync(EXCEPTIONS_FILE, 'utf8')).exceptions;
const today = new Date().toISOString().slice(0, 10);
const advisories = new Map(); // url → { title, severity, packages }
for (const [name, vuln] of Object.entries(JSON.parse(report).vulnerabilities ?? {})) {
  for (const via of vuln.via) {
    if (typeof via === 'string') continue; // dépend d'un autre paquet vulnérable, déjà compté
    const entry = advisories.get(via.url) ?? { title: via.title, severity: via.severity, packages: new Set() };
    entry.packages.add(name);
    advisories.set(via.url, entry);
  }
}

let blocked = 0;
for (const [url, a] of advisories) {
  const id = url.split('/').pop();
  const exception = exceptions.find((x) => x.id === id);
  const valid = exception && exception.reviewBy >= today;
  const label = `[${a.severity}] ${id} ${a.title} (${[...a.packages].join(', ')})`;
  if (!BLOCKING.has(a.severity)) console.log(`info     ${label}`);
  else if (valid) console.log(`accepté  ${label}\n         → ${exception.reason} (à revoir avant le ${exception.reviewBy})`);
  else {
    blocked++;
    console.log(`BLOQUANT ${label}${exception ? `\n         → exception expirée le ${exception.reviewBy} : à réévaluer` : ''}`);
  }
}

if (blocked) {
  console.error(`\n${blocked} faille(s) haute(s) ou critique(s) sans exception valide : corriger, ou documenter dans security/audit-exceptions.json.`);
  process.exit(1);
}
console.log(`\nAudit OK : ${advisories.size} alerte(s), aucune bloquante.`);
