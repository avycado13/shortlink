import pino from 'pino';
import type express from 'ultimate-express';

const logger = pino();

export function generateUniqueString(length: number = 12): string {
  const characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let uniqueString = '';
  for (let index = 0; index < length; index++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    uniqueString += characters[randomIndex];
  }
  return uniqueString;
}

export function isValidSlug(slug: string): boolean {
  if (!slug || typeof slug !== 'string') return false;
  return /^[\w-]{3,32}$/.test(slug);
}

export function isValidUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isValidDomain(domain: string): boolean {
  if (!domain || typeof domain !== 'string') return false;
  const domainRegex =
    /^(?:[\da-z](?:[\da-z-]{0,61}[\da-z])?\.)*[\da-z](?:[\da-z-]{0,61}[\da-z])?(?::\d+)?$/i;
  return domainRegex.test(domain) && domain.length <= 253;
}

export function errorNotification(
  error: Error,
  string_: string,
  request: express.Request,
): void {
  logger.error(
    {
      err: error,
      method: request.method,
      url: request.url,
    },
    string_,
  );
}
