import { and, eq, sql } from "drizzle-orm";
import { db } from "./drizzle";
import { links, domains } from "./schema";

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

