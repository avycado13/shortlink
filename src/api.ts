import { and, eq } from 'drizzle-orm';
import type { Router } from 'ultimate-express';
import express from 'ultimate-express';

import { database } from './drizzle';
import {
  generateUniqueString,
  isValidDomain,
  isValidSlug,
  isValidUrl,
} from './helpers';
import { domainQuery } from './queries';
import { domains, links } from './schema';

export const apiRouter: Router = express.Router();

// Domain middleware - skip for domains and links endpoints
apiRouter.use(async (request, response, next) => {
  // Skip domain check for domains and links endpoints
  if (
    request.path.startsWith('/domains') ||
    request.path.startsWith('/links')
  ) {
    return next();
  }

  const host = request.hostname.toLowerCase();

  try {
    const domainData = await domainQuery
      .execute({ domain: host })
      .then(r => r[0]);

    if (!domainData) {
      return response
        .status(404)
        .json({ error: 'Domain not found or disabled' });
    }

    // Fetch full domain object with enabled status
    const fullDomain = await database
      .select()
      .from(domains)
      .where(eq(domains.id, domainData.id))
      .limit(1)
      .then(r => r[0]);

    if (!fullDomain?.enabled) {
      return response
        .status(404)
        .json({ error: 'Domain not found or disabled' });
    }

    response.locals.domain = fullDomain;
    next();
  } catch (error) {
    request.log.error({ error }, 'Domain lookup failed');
    return response.status(500).json({ error: 'Internal server error' });
  }
});

apiRouter.post(
  '/links/create',
  express.json(),
  async (request, response): Promise<void> => {
    try {
      const { slug, url, domain } = request.body;

      // Validate domain
      if (!domain?.id) {
        response
          .status(400)
          .json({ error: 'Domain is required and must have an id' });
        return;
      }

      // Validate URL
      if (!url || !isValidUrl(url)) {
        response.status(400).json({ error: 'Invalid URL format' });
        return;
      }

      // Validate or generate slug
      let finalSlug: string;
      if (slug) {
        if (!isValidSlug(slug)) {
          response.status(400).json({
            error:
              'Invalid slug format. Must be 3–32 alphanumeric characters with dashes/underscores',
          });
          return;
        }
        finalSlug = slug;
      } else {
        finalSlug = generateUniqueString(16); // ← you must implement this
      }

      // Check if slug already exists for this domain
      const existing = await database
        .select({ id: links.id })
        .from(links)
        .where(and(eq(links.slug, finalSlug), eq(links.domainId, domain.id)))
        .limit(1);

      if (existing.length > 0) {
        response.status(409).json({ error: 'Slug already exists' });
        return;
      }

      // Insert link
      const [inserted] = await database
        .insert(links)
        .values({
          slug: finalSlug,
          url,
          domainId: domain.id,
          active: true,
        })
        .returning({
          id: links.id,
          slug: links.slug,
        });

      response.status(201).json({
        message: 'Link created successfully',
        link: inserted,
      });
    } catch (error) {
      request.log?.error({ error }, 'Failed to create link');
      response.status(500).json({ error: 'Failed to create link' });
    }
  },
);

apiRouter.get('/links', async (request, response) => {
  try {
    const domainLinks = await database
      .select()
      .from(links)
      .leftJoin(domains, eq(links.domainId, domains.id));

    response.json(domainLinks);
  } catch (error) {
    request.log.error({ error }, 'Failed to fetch links');
    response.status(500).json({ error: 'Failed to fetch links' });
  }
});

apiRouter.get('/domains', async (request, response) => {
  try {
    const allDomains = await database
      .select()
      .from(domains)
      .where(eq(domains.enabled, true));

    response.json(allDomains);
  } catch (error) {
    request.log.error({ error }, 'Failed to fetch domains');
    response.status(500).json({ error: 'Failed to fetch domains' });
  }
});

apiRouter.post(
  '/domains/create',
  express.json(),
  async (request, response): Promise<void> => {
    try {
      const { domain: domainName } = request.body;

      // Validate domain name
      if (!domainName || !isValidDomain(domainName)) {
        response.status(400).json({ error: 'Invalid domain format' });
        return;
      }

      // Check if domain already exists
      const existing = await database
        .select({ id: domains.id })
        .from(domains)
        .where(eq(domains.domain, domainName))
        .limit(1);

      if (existing.length > 0) {
        response.status(409).json({ error: 'Domain already exists' });
        return;
      }

      // Insert domain
      const insertResult = await database
        .insert(domains)
        .values({
          domain: domainName,
          enabled: true,
          main: false,
        })
        .returning({ id: domains.id, domain: domains.domain });

      response.status(201).json({
        message: 'Domain created successfully',
        domain: insertResult[0],
      });
      return;
    } catch (error) {
      request.log.error({ error }, 'Failed to create domain');
      response.status(500).json({ error: 'Failed to create domain' });
      return;
    }
  },
);
