import { and, eq } from 'drizzle-orm';
import type { Router } from 'ultimate-express';
import express from 'ultimate-express';

import { database } from './drizzle.js';
import {
  generateUniqueString,
  isValidDomain,
  isValidSlug,
  isValidUrl,
} from './helpers.js';
import { domainQuery } from './queries.js';
import { domains, links } from './schema.js';

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

apiRouter.post(
  '/links/create',
  express.json(),
  async (request, response): Promise<void> => {
    try {
      const { slug, url, domain } = request.body;

      // Validate URL
      if (!url || !isValidUrl(url)) {
        response.status(400).json({ error: 'Invalid URL format' });
        return;
      }

      // Find domain by name
      let domainId: number;
      if (typeof domain === 'string') {
        // Look up domain by name
        const domainRecord = await database
          .select({ id: domains.id })
          .from(domains)
          .where(eq(domains.domain, domain))
          .limit(1);

        if (domainRecord.length === 0) {
          response.status(400).json({ error: 'Domain not found' });
          return;
        }
        domainId = domainRecord[0].id;
      } else if (domain?.id) {
        domainId = domain.id;
      } else {
        response.status(400).json({ error: 'Valid domain is required' });
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
        finalSlug = generateUniqueString(16);
      }

      // Check if slug already exists for this domain
      const existing = await database
        .select({ id: links.id })
        .from(links)
        .where(and(eq(links.slug, finalSlug), eq(links.domainId, domainId)))
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
          domainId,
          active: true,
        })
        .returning({
          id: links.id,
          slug: links.slug,
        });

      response.status(201).json({
        message: 'Link created successfully',
        link: inserted,
        slug: finalSlug, // Include slug in response for frontend
      });
    } catch (error) {
      request.log?.error({ error }, 'Failed to create link');
      response.status(500).json({ error: 'Failed to create link' });
    }
  },
);

apiRouter.delete('/links/:slug', async (request, response) => {
  try {
    const { slug } = request.params;
    const { domain } = request.query;

    if (!domain) {
      response
        .status(400)
        .json({ error: 'Domain query parameter is required' });
      return;
    }

    // Find domain by name
    const domainRecord = await database
      .select({ id: domains.id })
      .from(domains)
      .where(eq(domains.domain, domain as string))
      .limit(1);

    if (domainRecord.length === 0) {
      response.status(400).json({ error: 'Domain not found' });
      return;
    }

    // Delete link with domain context
    const deleteResult = await database
      .delete(links)
      .where(and(eq(links.slug, slug), eq(links.domainId, domainRecord[0].id)))
      .returning({ id: links.id });

    if (deleteResult.length === 0) {
      response.status(404).json({ error: 'Link not found' });
    } else {
      response.json({ message: 'Link deleted successfully' });
    }
  } catch (error) {
    request.log.error({ error }, 'Failed to delete link');
    response.status(500).json({ error: 'Failed to delete link' });
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

apiRouter.delete('/domains/:domain', async (request, response) => {
  try {
    const { domain: domainName } = request.params;

    // Delete domain
    const deleteResult = await database
      .delete(domains)
      .where(eq(domains.domain, domainName))
      .returning({ id: domains.id });

    if (deleteResult.length === 0) {
      response.status(404).json({ error: 'Domain not found' });
    } else {
      response.json({ message: 'Domain deleted successfully' });
    }
  } catch (error) {
    request.log.error({ error }, 'Failed to delete domain');
    response.status(500).json({ error: 'Failed to delete domain' });
  }
});
