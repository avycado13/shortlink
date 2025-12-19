import "dotenv/config";
import express from "ultimate-express";
import errorhandler from "errorhandler";
import { errorNotification } from "./helpers";
import { apiRouter } from "./api";
import compression from "compression";
import pinoHttp from "pino-http";
import pino from "pino";
import path from "path";
import { domainQuery, redirectQuery } from "./queries";
import { fileURLToPath } from "url";
import { uiRouter } from "./ui";
import { db } from "./drizzle";
import { domains } from "./schema";
import { eq } from "drizzle-orm";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const PORT = parseInt(process.env.PORT || "3000", 10);
const NODE_ENV = process.env.NODE_ENV || "development";
const isDev = NODE_ENV === "development";

// Logger
const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: isDev
    ? { target: "pino-pretty", options: { colorize: true } }
    : undefined,
});

const app = express();
const httpLogger = pinoHttp({ logger });

// Trust proxy - important for production
app.set("trust proxy", true);
app.set("catch async errors", true);

// Logging middleware
app.use(httpLogger);

// Static files and templating
app.use(express.static("public"));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Compression middleware
app.use(compression());

// Error handler (development only)
if (isDev) {
  app.use(errorhandler({ log: errorNotification }));
}

// Security headers
app.use((_, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  next();
});

app.disable("x-powered-by");

// API routes
app.use("/api", apiRouter);

// Main redirect endpoint
app.get("/s/:slug", async (req, res): Promise<any> => {
  const start = performance.now();
  const { slug } = req.params;

  try {
    // Get domain for redirect - try hostname first, then fallback
    let domain = await domainQuery
      .execute({ domain: req.hostname.toLowerCase() })
      .then((r) => r[0]);

    if (!domain) {
      const availableDomains = await db
        .select()
        .from(domains)
        .limit(1);
      domain = availableDomains[0];
    }

    if (!domain) {
      return res.status(404).json({ error: "Domain not configured" });
    }

    const [link] = await redirectQuery.execute({
      domainId: domain.id,
      slug,
    });

    if (!link) {
      req.log.warn({ slug }, "Link not found");
      return res.status(404).json({ error: "Link not found" });
    }

    if (
      !link.url?.startsWith("http://") &&
      !link.url?.startsWith("https://")
    ) {
      req.log.error({ slug, url: link.url }, "Invalid redirect URL");
      return res
        .status(400)
        .json({ error: "Invalid redirect target" });
    }

    const duration = performance.now() - start;
    res.redirect(302, link.url);
    req.log.info(
      { slug, url: link.url, duration },
      "Redirect successful"
    );
  } catch (error) {
    req.log.error({ error, slug }, "Redirect failed");
    return res.status(500).json({ error: "Redirect failed" });
  }
});

// Domain middleware for UI routes
app.use(async (req, res, next): Promise<any> => {
  const host = req.hostname.toLowerCase();

  try {
    const domainData = await domainQuery
      .execute({ domain: host })
      .then((r) => r[0]);

    if (!domainData) {
      return res
        .status(404)
        .json({ error: "Domain not found or disabled" });
    }

    // Fetch full domain object with enabled status
    const fullDomain = await db
      .select()
      .from(domains)
      .where(eq(domains.id, domainData.id))
      .limit(1)
      .then((r) => r[0]);

    if (!fullDomain?.enabled) {
      return res
        .status(404)
        .json({ error: "Domain not found or disabled" });
    }

    res.locals.domain = fullDomain;
    next();
  } catch (error) {
    req.log.error({ error }, "Domain lookup failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// UI routes
app.use("/", uiRouter);

// 404 handler
app.use((_req, res, _next) => {
  res.status(404).json({ error: "Not found" });
});

// Global error handler
app.use(
  (err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error({ error: err }, "Unhandled error");
    res.status(500).json({ error: "Internal server error" });
  }
);

// Start server
const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT} (${NODE_ENV})`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received: starting graceful shutdown");
  server.close(async () => {
    logger.info("HTTP server closed");
    process.exit(0);
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 30000);
});

process.on("SIGINT", () => {
  logger.info("SIGINT received: starting graceful shutdown");
  server.close(async () => {
    logger.info("HTTP server closed");
    process.exit(0);
  });
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  logger.error({ reason, promise }, "Unhandled rejection");
  process.exit(1);
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  logger.error({ error }, "Uncaught exception");
  process.exit(1);
});
