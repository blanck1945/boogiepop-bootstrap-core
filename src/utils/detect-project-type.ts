import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';
import type { ProjectType } from '../types';

export async function detectProjectType(projectDir: string): Promise<ProjectType | null> {
  const has = (rel: string) => existsSync(join(projectDir, rel));

  if (has('app/Home.py') || has('Home.py')) {
    if (has('requirements.txt')) {
      try {
        const req = await readFile(join(projectDir, 'requirements.txt'), 'utf8');
        if (/streamlit/i.test(req)) return 'streamlit';
      } catch {
        return 'streamlit';
      }
    }
    return 'streamlit';
  }

  if (has('vite.config.ts') || has('vite.config.js')) {
    try {
      const cfgPath = has('vite.config.ts') ? 'vite.config.ts' : 'vite.config.js';
      const cfg = await readFile(join(projectDir, cfgPath), 'utf8');
      if (/ModuleFederation|module-federation|federation/i.test(cfg)) return 'vite';
    } catch {
      return 'vite';
    }
  }

  if (has('next.config.ts') || has('next.config.js') || has('next.config.mjs')) {
    return 'next';
  }

  return null;
}
