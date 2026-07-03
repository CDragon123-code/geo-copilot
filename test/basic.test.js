// GEO Copilot — basic structure validation
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const required = [
  'manifest.json',
  'popup.html',
  'dashboard.html',
  'src/background.js',
  'src/analyzer.js',
  'src/content.js',
  'src/dashboard.js',
  'src/popup.js',
  'src/content.css',
  'src/ui.css',
  'assets/icons/icon-16.png',
  'assets/icons/icon-48.png',
  'assets/icons/icon-128.png',
  'README.md',
  'PRIVACY.md',
];

let failed = 0;

for (const file of required) {
  const p = path.join(ROOT, file);
  if (!fs.existsSync(p)) {
    console.error(`MISSING: ${file}`);
    failed++;
  }
}

// Validate manifest.json structure
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf-8'));
if (manifest.manifest_version !== 3) {
  console.error('Manifest version must be 3');
  failed++;
}

if (!manifest.name || !manifest.description || !manifest.version) {
  console.error('Manifest missing required fields');
  failed++;
}

console.log(`Checked ${required.length} files, ${failed} failures`);
if (failed > 0) {
  console.log('⚠️  Some checks failed');
} else {
  console.log('✅ All checks passed');
}

// Exit with failure if any check failed
process.exit(failed > 0 ? 1 : 0);
