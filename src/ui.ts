import express from "ultimate-express";
import { getAllLinksQuery } from "./queries";

export const uiRouter = express.Router();


uiRouter.get("/", async (_req, res) => {
  // res.sendFile("index.html", { root: "public" });
  res.sendFile("index.html", { root: "public"});
});


// uiRouter.get("/stats", (_req, res) => {
//   res.sendFile("stats.html", { root: "public" });
// });