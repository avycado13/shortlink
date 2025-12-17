import { and, eq, sql } from "drizzle-orm";
import type express from "ultimate-express";
import { db } from "./drizzle";
import { links, domains } from "./schema";

export function generateUniqueString(length: number = 12): string {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let uniqueString = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    uniqueString += characters[randomIndex];
  }
  return uniqueString;
}

function isValidSlug(slug: string) {
  return /^[a-zA-Z0-9_-]{3,32}$/.test(slug);
}

function isValidUrl(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function errorNotification(err: Error, str: string, req: express.Request) {
  console.error(`Error in ${req.method} ${req.url}`, str);
}

export const redirectQuery = db
  .select({ url: links.url })
  .from(links)
  .where(
    and(
      eq(links.domainId, sql.placeholder("domainId")),
      eq(links.slug, sql.placeholder("slug"))
    )
  )
  .limit(1)
  .prepare("redirect_by_domain_slug");

export const domainQuery = db
  .select({ id: domains.id })
  .from(domains)
  .where(eq(domains.domain, sql.placeholder("domain")))
  .limit(1)
  .prepare("domain_by_name");

export const getAllLinksQuery = db
  .select()
  .from(links)
  .prepare("get_all_links_by_domain");

