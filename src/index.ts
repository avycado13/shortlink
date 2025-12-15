import express from "ultimate-express";
import { db } from "./drizzle";
import { links } from "./schema";
import { eq, sql } from "drizzle-orm";

const app = express();

const slugUrl = db
  .select({ url: links.url })
  .from(links)
  .where(eq(links.slug, sql.placeholder('slug')))
  .limit(1)
  .prepare('slugUrl');

app.get("/", (_req, res) => {
  res.send("Hello World!");
});

app.get("/s/:slug", async (req, res) => {
  const { slug } = req.params;
  const [link] = await slugUrl.execute({ slug });
  res.redirect(link.url ? link.url : "https://google.com");
});

app.post("/api/create", express.json(), async (req, res) => {
  const { slug, url } = req.body;
  await db.insert(links).values({ slug, url });
  res.status(201).send({ message: "Link created" });
});
app.use(express.static("public"));

app.get("/create", (req, res) => {
  res.sendFile("create.html", { root: "public" });
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
