const fs = require('fs');
const path = require('path');

const apiBaseUrl = process.env.FRONTEND_API_BASE_URL || process.env.COLDMOVIE_API_BASE_URL;

if (!apiBaseUrl) {
  process.exit(0);
}

const environmentPath = path.join(__dirname, '..', 'src', 'environments', 'environment.ts');
const source = fs.readFileSync(environmentPath, 'utf8');
const normalizedUrl = apiBaseUrl.replace(/\/+$/, '');
const escapedUrl = normalizedUrl.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const nextSource = source.replace(/apiBaseUrl:\s*'[^']*'/, `apiBaseUrl: '${escapedUrl}'`);

fs.writeFileSync(environmentPath, nextSource);
console.log(`Frontend API base URL set to ${normalizedUrl}`);
