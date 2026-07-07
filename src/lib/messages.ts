import {readFile} from 'node:fs/promises';
import path from 'node:path';
import type {AppMessages} from './types';

let cachedMessages: AppMessages | null = null;

export async function getAppMessages() {
  if (cachedMessages) {
    return cachedMessages;
  }

  const file = await readFile(path.join(process.cwd(), 'src', 'locales', 'en.json'), 'utf8');
  const source = file.trim();

  try {
    cachedMessages = JSON.parse(source) as AppMessages;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown JSON parse error.';
    throw new Error(`Failed to parse app messages (${source.length} chars): ${message}`);
  }

  return cachedMessages;
}
