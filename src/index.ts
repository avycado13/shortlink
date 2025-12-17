import express from "ultimate-express";
import errorhandler from "errorhandler";
import {  errorNotification } from "./helpers";
import { apiRouter } from "./api";
import compression from "compression";
import pinoHttp from "pino-http";
import path from "path";
import { domainQuery, redirectQuery } from "./queries";
import { uiRouter } from "./ui";

const app = express();
const pino = pinoHttp();

app.set("trust proxy", true);
app.set("catch async errors", true);
app.use(pino)

app.use(express.static("public"));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use((_, res, next) => {
  res.setTimeout(5_000, () => res.sendStatus(504));
  next();
});
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

app.use((_req, res, _next) => {
  res.status(404).send("Sorry can't find that!")
})



app.use(async (req, res, next) => {
  const host = req.hostname.toLowerCase();

  const domain = await domainQuery.execute({ domain: host }).then((r) => r[0]);

  if (!domain) {
    return res.sendStatus(404);
  }

  res.locals.domain = domain;
  next();
});

app.use("/api", apiRouter);
app.use("/", uiRouter);

app.get("/s/:slug", async (req, res) => {
  const start = performance.now();
  const { slug } = req.params;
  const domain = res.locals.domain;

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
