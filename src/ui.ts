import express from "ultimate-express";
import type { Router } from "ultimate-express";

export const uiRouter: Router = express.Router();

uiRouter.get("/", async (_req, res) => {
  res.sendFile("index.html", { root: "public" });
});
