CREATE TABLE "clicks" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "clicks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"link_id" integer NOT NULL,
	"clicked_at" timestamp DEFAULT now() NOT NULL,
	"ip" text,
	"country" text,
	"city" text,
	"referrer" text,
	"user_agent" text,
	"device" text,
	"os" text,
	"browser" text
);
--> statement-breakpoint
CREATE TABLE "domain_settings" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "domain_settings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"domain_id" integer NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "domains" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "domains_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"domain" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"main" boolean DEFAULT false NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "domains_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE TABLE "links" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "links_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"slug" text,
	"url" text NOT NULL,
	"domain_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clicks" ADD CONSTRAINT "clicks_link_id_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_settings" ADD CONSTRAINT "domain_settings_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clicks_link_id_idx" ON "clicks" USING btree ("link_id");--> statement-breakpoint
CREATE INDEX "clicks_clicked_at_idx" ON "clicks" USING btree ("clicked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "domain_settings_domain_key_idx" ON "domain_settings" USING btree ("domain_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "domains_domain_idx" ON "domains" USING btree ("domain");--> statement-breakpoint
CREATE UNIQUE INDEX "domains_one_main_idx" ON "domains" USING btree ("main") WHERE main = true;--> statement-breakpoint
CREATE UNIQUE INDEX "slug_idx" ON "links" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "links_domain_slug_idx" ON "links" USING btree ("domain_id","slug");