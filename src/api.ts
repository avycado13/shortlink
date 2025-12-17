import express from "ultimate-express";
import { db } from "./drizzle";
import { links } from "./schema";
import { domainQuery } from "./helpers";

export const apiRouter = express.Router()

apiRouter.use(async (req, res, next) => {
  const host = req.hostname.toLowerCase();

  const domain = await domainQuery.execute({ domain: host }).then((r) => r[0]);

  if (!domain) {
    return res.sendStatus(404);
  }

  res.locals.domain = domain;
  next();
});

apiRouter.post("/api/create", express.json(), async (req, res) => {
  const { slug, url } = req.body;
  const domain = res.locals.domain;

  await db.insert(links).values({
    slug,
    url,
    domainId: domain.id,
    active: true,
  });

  res.status(201).send({ message: "Link created" });
});