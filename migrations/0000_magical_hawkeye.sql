CREATE TABLE "links" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "links_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"slug" varchar,
	"url" varchar
);
--> statement-breakpoint
CREATE UNIQUE INDEX "slug_idx" ON "links" USING btree ("slug");