import express from "ultimate-express";
import errorhandler from "errorhandler";
import {  errorNotification } from "./helpers";
import { apiRouter } from "./api";
import compression from "compression";
import pinoHttp from "pino-http";
import path from "path";
import { domainQuery, redirectQuery } from "./queries";
import { fileURLToPath } from 'url';
import { uiRouter } from "./ui";
import { db } from "./drizzle";
import { domains } from "./schema";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const pino = pinoHttp();

app.set("trust proxy", true);
app.set("catch async errors", true);
app.use(pino)

app.use(express.static("public"));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(compression())


if (process.env.NODE_ENV === "development") {
  app.use(errorhandler({ log: errorNotification }));
}

app.use((_, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});
app.disable("x-powered-by");

app.use("/api", apiRouter);

app.get("/s/:slug", async (req, res) => {
  const start = performance.now();
  const { slug } = req.params;
  
  // Get domain for redirect - try localhost first, then fallback to any domain
  let domain = await domainQuery.execute({ domain: "localhost:3000" }).then((r) => r[0]);
  if (!domain) {
    const availableDomains = await db.select().from(domains).limit(1);
    domain = availableDomains[0];
  }

  if (!domain) {
    return res.sendStatus(404);
  }

  const [link] = await redirectQuery.execute({
    domainId: domain.id,
    slug,
  });

  if (!link) return res.sendStatus(404);
  if (!link.url?.startsWith("http://") && !link.url?.startsWith("https://")) {
    return res.sendStatus(400);
  }

  res.redirect(302, link.url ? link.url : "/");
  res.on("finish", () => {
    req.log.debug(` ${performance.now() - start}ms - Redirected ${slug} to ${link.url}`);
  });
});

app.use(async (req, res, next) => {
  const host = req.hostname.toLowerCase();

  const domain = await domainQuery.execute({ domain: host }).then((r) => r[0]);

  if (!domain) {
    return res.sendStatus(404);
  }

  res.locals.domain = domain;
  next();
});

app.use("/", uiRouter);

// 404 handler
app.use((_req, res, _next) => {
  res.status(404).send("Sorry can't find that!")
});

// app.get("/create", (_req, res) => {
//   res.sendFile("create.html", { root: "public" });
// });

const server = app.listen(3000, () => {
  console.log("🚀 Server running on port 3000");
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server')
  server.close(() => {
    console.log('HTTP server closed')
  })
})
