import express from "ultimate-express";
import type { Router } from "ultimate-express";
import { db } from "./drizzle";
import { domains, links } from "./schema";
import { domainQuery } from "./queries";
import { eq } from "drizzle-orm";
import { isValidSlug, isValidUrl, isValidDomain } from "./helpers";

export const apiRouter: Router = express.Router();

// Domain middleware - skip for domains and links endpoints
apiRouter.use(async (req, res, next) => {
  // Skip domain check for domains and links endpoints
  if (req.path.startsWith("/domains") || req.path.startsWith("/links")) {
    return next();
  }

  const host = req.hostname.toLowerCase();

  try {
    const domainData = await domainQuery.execute({ domain: host }).then((r) => r[0]);

    if (!domainData) {
      return res.status(404).json({ error: "Domain not found or disabled" });
    }

    // Fetch full domain object with enabled status
    const fullDomain = await db
      .select()
      .from(domains)
      .where(eq(domains.id, domainData.id))
      .limit(1)
      .then((r) => r[0]);

    if (!fullDomain?.enabled) {
      return res.status(404).json({ error: "Domain not found or disabled" });
    }

    res.locals.domain = fullDomain;
    next();
  } catch (error) {
    req.log.error({ error }, "Domain lookup failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

apiRouter.post("/links/create", express.json(), async (req, res): Promise<any> => {
  try {
    const { slug, url, domain } = req.body;

    // Validate domain
    if (!domain || !domain.id) {
      return res.status(400).json({ error: "Domain is required and must have an id" });
    }

    // Validate URL
    if (!url || !isValidUrl(url)) {
      return res.status(400).json({ error: "Invalid URL format" });
    }

    // Validate or generate slug
    let finalSlug = slug;
    if (slug && !isValidSlug(slug)) {
      return res.status(400).json({ error: "Invalid slug format. Must be 3-32 alphanumeric characters with dashes/underscores" });
    }

    // Check if slug already exists for this domain
    if (finalSlug) {
      const existing = await db
        .select({ id: links.id })
        .from(links)
        .where(eq(links.slug, finalSlug))
        .limit(1);

      if (existing.length > 0) {
        return res.status(409).json({ error: "Slug already exists" });
      }
    }

    // Insert link
    const insertResult = await db.insert(links).values({
      slug: finalSlug,
      url,
      domainId: domain.id,
      active: true,
    }).returning({ id: links.id, slug: links.slug });

    return res.status(201).json({ 
      message: "Link created successfully",
      link: insertResult[0]
    });
  } catch (error) {
    req.log.error({ error }, "Failed to create link");
    return res.status(500).json({ error: "Failed to create link" });
  }
});

apiRouter.get("/links", async (req, res) => {
  try {
    const domainLinks = await db
      .select()
      .from(links)
      .leftJoin(domains, eq(links.domainId, domains.id));
    
    res.json(domainLinks);
  } catch (error) {
    req.log.error({ error }, "Failed to fetch links");
    res.status(500).json({ error: "Failed to fetch links" });
  }
});

apiRouter.get("/domains", async (req, res) => {
  try {
    const allDomains = await db
      .select()
      .from(domains)
      .where(eq(domains.enabled, true));
    
    res.json(allDomains);
  } catch (error) {
    req.log.error({ error }, "Failed to fetch domains");
    res.status(500).json({ error: "Failed to fetch domains" });
  }
});

apiRouter.post("/domains/create", express.json(), async (req, res): Promise<any> => {
  try {
    const { domain: domainName } = req.body;

    // Validate domain name
    if (!domainName || !isValidDomain(domainName)) {
      return res.status(400).json({ error: "Invalid domain format" });
    }

    // Check if domain already exists
    const existing = await db
      .select({ id: domains.id })
      .from(domains)
      .where(eq(domains.domain, domainName))
      .limit(1);

    if (existing.length > 0) {
      return res.status(409).json({ error: "Domain already exists" });
    }

    // Insert domain
    const insertResult = await db
      .insert(domains)
      .values({
        domain: domainName,
        enabled: true,
        main: false,
      })
      .returning({ id: domains.id, domain: domains.domain });

    return res.status(201).json({ 
      message: "Domain created successfully",
      domain: insertResult[0]
    });
  } catch (error) {
    req.log.error({ error }, "Failed to create domain");
    return res.status(500).json({ error: "Failed to create domain" });
  }
});
