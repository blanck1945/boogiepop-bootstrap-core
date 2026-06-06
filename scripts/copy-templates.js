const { cpSync, mkdirSync } = require('fs');
const { join } = require('path');

const root = join(__dirname, '..');
const src = join(root, 'templates');
const dest = join(root, 'dist', 'templates');

mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log('Templates copied to dist/templates');
