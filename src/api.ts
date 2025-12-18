import express from "ultimate-express";
import { db } from "./drizzle";
import { domains, links } from "./schema";
import { domainQuery } from "./queries";
import { eq } from "drizzle-orm";

export const apiRouter = express.Router()

// Domain middleware - skip for domains and links endpoints
apiRouter.use(async (req, res, next) => {
  // Skip domain check for domains and links endpoints
  if (req.path.startsWith('/domains') || req.path.startsWith('/links')) {
    return next();
  }

  const host = req.hostname.toLowerCase();

  const domain = await domainQuery.execute({ domain: host }).then((r) => r[0]);

  if (!domain) {
    return res.sendStatus(404);
  }

  res.locals.domain = domain;
  next();
});

apiRouter.post("/links/create", express.json(), async (req, res) => {
  const { slug, url } = req.body;
  
  // Get domain from res.locals or fallback to first available domain
  let domain = res.locals.domain;
  if (!domain) {
    const availableDomains = await db.select().from(domains).limit(1);
    domain = availableDomains[0];
  }

  if (!domain) {
    return res.status(400).send({ error: "No domain available" });
  }

  await db.insert(links).values({
    slug,
    url,
    domainId: domain.id,
    active: true,
  });

  res.status(201).send({ message: "Link created" });
});

apiRouter.get("/links", async (req, res) => {
  // Get domain from res.locals or fallback to first available domain
  let domain = res.locals.domain;
  if (!domain) {
    const availableDomains = await db.select().from(domains).limit(1);
    domain = availableDomains[0];
  }

  if (!domain) {
    return res.send([]);
  }

  const domainLinks = await db
    .select()
    .from(links)
    .where(eq(domain.id,links.domainId));

  res.send(domainLinks);
})

apiRouter.get("/domains", async (req, res) => {
  const domain = await db.select().from(domains);
  res.send(domain);
});
  apiRouter.post("/domains/create", express.json(), async (req, res) => {
  const { domain: domainName } = req.body;

  await db.insert(domains).values({
    domain: domainName,
    enabled: true,
    main: false,
  });

  res.status(201).send({ message: "Domain created" });
});
