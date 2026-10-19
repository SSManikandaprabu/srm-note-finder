const fs = require('fs');
const { execSync } = require('child_process');

const env = fs.readFileSync('backend/.env', 'utf8');
const lines = env.split('\n').filter(l => l.trim() && !l.startsWith('#'));

for (const line of lines) {
  const eq = line.indexOf('=');
  if (eq === -1) continue;
  const key = line.slice(0, eq).trim();
  const val = line.slice(eq + 1).trim();
  console.log(`Setting ${key}...`);
  try {
    // Vercel CLI allows piping value: echo "val" | vercel env add KEY production
    execSync(`npx vercel env add ${key} production --force`, {
      input: val + '\n',
      cwd: 'backend',
      stdio: ['pipe', 'inherit', 'inherit']
    });
  } catch (e) {
    console.log(`Failed for ${key}:`, e.message);
  }
}
console.log('Environment variable sync complete.');
