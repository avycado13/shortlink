import 'dotenv/config';

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import compression from 'compression';
import { eq } from 'drizzle-orm';
import errorhandler from 'errorhandler';
import pino from 'pino';
import pinoHttp from 'pino-http';
import express from 'ultimate-express';

import { apiRouter } from './api-router.js';
import { database as database } from './drizzle.js';
import { errorNotification } from './helpers.js';
import { domainQuery, redirectQuery } from './queries.js';
import { domains } from './schema.js';
import { uiRouter } from './ui-router.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const PORT = Number.parseInt(process.env.PORT || '3000', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';
const isDevelopment = NODE_ENV === 'development';

// Logger
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: isDevelopment
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});

const app = express();
const httpLogger = pinoHttp({ logger });

// Trust proxy - important for production
app.set('trust proxy', true);
app.set('catch async errors', true);

// Logging middleware
app.use(httpLogger);

// Static files and templating
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Compression middleware
app.use(compression());

// Error handler (development only)
if (isDevelopment) {
  app.use(errorhandler({ log: errorNotification }));
}

// Security headers
app.use((_, response, next) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('X-XSS-Protection', '1; mode=block');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=()',
  );
  next();
});

app.disable('x-powered-by');
// API routes
app.use('/api', apiRouter);
// Main redirect endpoint
app.get('/s/:slug', async (request, response): Promise<void> => {
  const start = performance.now();
  const { slug } = request.params;

  try {
    // Get domain for redirect - try hostname first, then fallback
    let domain = await domainQuery
      .execute({ domain: request.hostname.toLowerCase() })
      .then(r => r[0]);

    if (!domain) {
      const availableDomains = await database.select().from(domains).limit(1);
      domain = availableDomains[0];
    }

    if (!domain) {
      response.status(404).json({ error: 'Domain not configured' });
      return;
    }

    const [link] = await redirectQuery.execute({
      domainId: domain.id,
      slug,
    });

    if (!link) {
      request.log.warn({ slug }, 'Link not found');
      response.status(404).json({ error: 'Link not found' });
      return;
    }

    if (!link.url?.startsWith('http://') && !link.url?.startsWith('https://')) {
      request.log.error({ slug, url: link.url }, 'Invalid redirect URL');
      response.status(400).json({ error: 'Invalid redirect target' });
      return;
    }

    const duration = performance.now() - start;
    response.redirect(302, link.url);
    request.log.info({ slug, url: link.url, duration }, 'Redirect successful');
  } catch (error) {
    request.log.error({ error, slug }, 'Redirect failed');
    response.status(500).json({ error: 'Redirect failed' });
    return;
  }
});

// Domain middleware for UI routes
app.use(async (request, response, next): Promise<void> => {
  const host = request.hostname.toLowerCase();

  try {
    const domainData = await domainQuery
      .execute({ domain: host })
      .then(r => r[0]);

    if (!domainData) {
      response.status(404).json({ error: 'Domain not found or disabled' });
      return;
    }

    // Fetch full domain object with enabled status
    const fullDomain = await database
      .select()
      .from(domains)
      .where(eq(domains.id, domainData.id))
      .limit(1)
      .then(r => r[0]);

    if (!fullDomain?.enabled) {
      response.status(404).json({ error: 'Domain not found or disabled' });
      return;
    }
    if (!fullDomain.main) {
      response.status(403).json({ error: 'Domain not configured as main' });
      return;
    }

    response.locals.domain = fullDomain;
    next();
  } catch (error) {
    request.log.error({ error }, 'Domain lookup failed');
    response.status(500).json({ error: 'Internal server error' });
    return;
  }
});

// UI routes
app.use('/', uiRouter);

// 404 handler
app.use((_request, response) => {
  response.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use(
  (error: Error, _request: express.Request, response: express.Response) => {
    logger.error({ error: error }, 'Unhandled error');
    response.status(500).json({ error: 'Internal server error' });
  },
);

// Start server
const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT} (${NODE_ENV})`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received: starting graceful shutdown');
  server.close(async () => {
    logger.info('HTTP server closed');
    process.exit(0);
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30_000);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received: starting graceful shutdown');
  server.close(async () => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled rejection');
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', error => {
  logger.error({ error }, 'Uncaught exception');
  process.exit(1);
});
