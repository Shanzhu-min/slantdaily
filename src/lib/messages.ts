import {readFile} from 'node:fs/promises';
import path from 'node:path';
import type {AppMessages} from './types';

let cachedMessages: AppMessages | null = null;

function getConfiguredSiteUrl(fallback: string) {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? fallback).replace(/\/$/, '');
}

function getHostname(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }
}

export async function getAppMessages() {
  if (cachedMessages) {
    return cachedMessages;
  }

  const file = await readFile(path.join(process.cwd(), 'src', 'locales', 'en.json'), 'utf8');
  const source = file.trim();

  try {
    const messages = JSON.parse(source) as AppMessages;
    const siteUrl = getConfiguredSiteUrl(messages.site.url);

    messages.site.url = siteUrl;
    messages.pages.printable.print.domain = getHostname(siteUrl);
    cachedMessages = messages;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown JSON parse error.';
    throw new Error(`Failed to parse app messages (${source.length} chars): ${message}`);
  }

  return cachedMessages;
}
