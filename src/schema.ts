import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

import { generateUniqueString } from './helpers';

export const links = pgTable(
  'links',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    slug: text().$default(() => generateUniqueString(16)),
    url: text().notNull(),
    domainId: integer('domain_id')
      .notNull()
      .references(() => domains.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    active: boolean().default(true).notNull(),
  },
  table => [
    uniqueIndex('slug_idx').on(table.slug),
    uniqueIndex('links_domain_slug_idx').on(table.domainId, table.slug),
  ],
);

export const domains = pgTable(
  'domains',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    domain: text().notNull().unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    main: boolean().default(false).notNull(),
    enabled: boolean().default(true).notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  table => [
    uniqueIndex('domains_domain_idx').on(table.domain),
    uniqueIndex('domains_one_main_idx')
      .on(table.main)
      .where(sql`main = true`),
  ],
);

export const domainSettings = pgTable(
  'domain_settings',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    domainId: integer('domain_id')
      .notNull()
      .references(() => domains.id, { onDelete: 'cascade' }),
    key: text().notNull(),
    value: text().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  table => [
    uniqueIndex('domain_settings_domain_key_idx').on(table.domainId, table.key),
  ],
);
export const clicks = pgTable(
  'clicks',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    linkId: integer('link_id')
      .notNull()
      .references(() => links.id, { onDelete: 'cascade' }),
    clickedAt: timestamp('clicked_at').defaultNow().notNull(),
    ip: text('ip'),
    country: text('country'),
    city: text('city'),
    referrer: text('referrer'),
    userAgent: text('user_agent'),
    device: text('device'), // mobile/desktop
    os: text('os'),
    browser: text('browser'),
  },
  table => [
    index('clicks_link_id_idx').on(table.linkId),
    index('clicks_clicked_at_idx').on(table.clickedAt),
  ],
);

export const Schema = {
  links,
  domains,
  domainSettings,
};
