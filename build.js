import { mkdir, copyFile, writeFile } from 'node:fs/promises';
// Explicit allowlist keeps source-only tests and local progress out of the deployment.
const files = ['index.html', 'style.css', 'favicon.svg', 'app.js', 'core.js', 'content.js', 'data.js', 'storage.js'];
await mkdir('dist', { recursive: true });
await Promise.all(files.map(file => copyFile(file, `dist/${file}`)));
await writeFile('dist/_headers', '/*\n  Cache-Control: public, max-age=0, must-revalidate\n');
console.log(`Netlify bundle ready: ${files.length} files in dist/`);
