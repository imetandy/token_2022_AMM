// Generate JS clients (instruction builders, PDAs, codecs) from Anchor IDLs using Kinobi
import { createFromRoot } from 'kinobi';
import { rootNodeFromAnchor } from '@kinobi-so/nodes-from-anchor';
import { renderVisitor as renderJavaScriptVisitor } from '@kinobi-so/renderers-js';
import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const idlDir = path.join(repoRoot, 'target', 'idl');
const outDir = path.join(repoRoot, 'app', 'app', 'clients');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

async function generateForIdl(idlFile, outSubDir) {
  const idl = readJson(path.join(idlDir, idlFile));
  const kinobi = createFromRoot(rootNodeFromAnchor(idl));
  const target = path.join(outDir, outSubDir);
  ensureDir(target);
  kinobi.accept(renderJavaScriptVisitor(target));
  console.log(`Generated client for ${idlFile} -> ${target}`);
}

async function main() {
  ensureDir(outDir);
  await generateForIdl('amm.json', 'amm');
  if (fs.existsSync(path.join(idlDir, 'token_setup.json'))) {
    await generateForIdl('token_setup.json', 'token_setup');
  }
}

main().catch((e) => {
  console.error('Generation failed:', e);
  process.exit(1);
});

