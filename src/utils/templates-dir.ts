import { join } from 'path';

export function getTemplatesDir(): string {
  return join(__dirname, '..', 'templates');
}
