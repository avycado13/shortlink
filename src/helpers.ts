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

