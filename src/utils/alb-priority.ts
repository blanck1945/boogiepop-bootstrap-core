import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

export async function nextAlbPriorities(
  terraformDir: string,
): Promise<{ http: number; https: number }> {
  let files: string[];
  try {
    files = await readdir(terraformDir);
  } catch {
    return { http: 10, https: 20 };
  }

  const albFiles = files.filter((f) => f.startsWith('alb_') && f.endsWith('.tf'));
  const httpPriorities: number[] = [];
  const httpsPriorities: number[] = [];

  for (const file of albFiles) {
    const content = await readFile(join(terraformDir, file), 'utf8');
    const blocks = content.split(/resource\s+"aws_lb_listener_rule"/);

    for (const block of blocks.slice(1)) {
      const nameMatch = block.match(/^\s+"(http[s]?_[^"]+)"/);
      const priorityMatch = block.match(/priority\s*=\s*(\d+)/);
      if (!nameMatch || !priorityMatch) continue;

      const resourceName = nameMatch[1];
      const priority = parseInt(priorityMatch[1], 10);
      if (resourceName.startsWith('https_')) {
        httpsPriorities.push(priority);
      } else {
        httpPriorities.push(priority);
      }
    }
  }

  const maxHttp = httpPriorities.length ? Math.max(...httpPriorities) : 9;
  const maxHttps = httpsPriorities.length ? Math.max(...httpsPriorities) : 19;

  return { http: maxHttp + 1, https: maxHttps + 1 };
}
