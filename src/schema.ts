import { integer, pgTable, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { generateUniqueString } from "./helpers";

export const links = pgTable(
  "links",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    slug: varchar().$default(() => generateUniqueString(16)),
    url: varchar()
  },
  (table) => [uniqueIndex("slug_idx").on(table.slug)]
);
