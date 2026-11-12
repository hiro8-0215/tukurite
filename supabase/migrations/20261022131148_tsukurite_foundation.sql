CREATE TABLE "challenges" (
	"id" text PRIMARY KEY NOT NULL,
	"user" text NOT NULL,
	"wallet" text NOT NULL,
	"message" text NOT NULL,
	"expires" bigint NOT NULL,
	"used" integer DEFAULT 0 NOT NULL
);


CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"user" text NOT NULL,
	"recipe" text NOT NULL,
	"kind" text NOT NULL,
	"period" text NOT NULL,
	"day" text NOT NULL,
	"eligible" integer NOT NULL,
	"created" text NOT NULL
);


CREATE UNIQUE INDEX "event_once" ON "events" ("user","recipe","kind","day");

CREATE TABLE "members" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"wallet" text,
	"created" text NOT NULL
);


CREATE TABLE "photos" (
	"id" text PRIMARY KEY NOT NULL,
	"owner" text NOT NULL,
	"mime" text NOT NULL,
	"created" text NOT NULL
);


CREATE TABLE "recipes" (
	"id" text PRIMARY KEY NOT NULL,
	"owner" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"ingredients" text NOT NULL,
	"steps" text NOT NULL,
	"minutes" integer NOT NULL,
	"servings" integer NOT NULL,
	"category" text NOT NULL,
	"image" text NOT NULL,
	"status" text NOT NULL,
	"version" integer NOT NULL,
	"hash" text NOT NULL,
	"sample" integer DEFAULT 0 NOT NULL,
	"created" text NOT NULL,
	"updated" text NOT NULL
);


CREATE TABLE "reports" (
	"id" text PRIMARY KEY NOT NULL,
	"user" text NOT NULL,
	"recipe" text NOT NULL,
	"reason" text NOT NULL,
	"created" text NOT NULL
);


CREATE TABLE "shelves" (
	"id" text PRIMARY KEY NOT NULL,
	"user" text NOT NULL,
	"recipe" text,
	"url" text DEFAULT '' NOT NULL,
	"title" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"ingredients" text DEFAULT '' NOT NULL,
	"steps" text DEFAULT '' NOT NULL,
	"created" text NOT NULL
);


CREATE UNIQUE INDEX "shelf_recipe_user" ON "shelves" ("user","recipe");

CREATE UNIQUE INDEX "shelf_url_user" ON "shelves" ("user","url");

CREATE TABLE "sources" (
	"id" text PRIMARY KEY NOT NULL,
	"owner" text NOT NULL,
	"recipe" text NOT NULL,
	"url" text NOT NULL,
	"code" text NOT NULL,
	"status" text NOT NULL,
	"checked" text,
	"created" text NOT NULL
);


CREATE UNIQUE INDEX "source_url" ON "sources" ("url");

CREATE TABLE "transfers" (
	"id" text PRIMARY KEY NOT NULL,
	"payer_user" text NOT NULL,
	"payer" text NOT NULL,
	"recipient" text NOT NULL,
	"author" text NOT NULL,
	"period" text NOT NULL,
	"amount" integer NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"signature" text,
	"created" text NOT NULL
);


CREATE UNIQUE INDEX "transfer_signature" ON "transfers" ("signature");

CREATE TABLE "versions" (
	"id" text PRIMARY KEY NOT NULL,
	"recipe" text NOT NULL,
	"version" integer NOT NULL,
	"hash" text NOT NULL,
	"snapshot" text NOT NULL,
	"signature" text,
	"chain_status" text DEFAULT 'unrecorded' NOT NULL,
	"created" text NOT NULL
);


CREATE UNIQUE INDEX "recipe_version" ON "versions" ("recipe","version");

CREATE UNIQUE INDEX "anchor_signature" ON "versions" ("signature");
ALTER TABLE "transfers" ADD "settlement_key" text;

CREATE UNIQUE INDEX "one_settlement" ON "transfers" ("settlement_key");
CREATE UNIQUE INDEX "member_wallet" ON "members" ("wallet");

CREATE TABLE ai_jobs(id uuid primary key default gen_random_uuid(), owner_id uuid not null, created_at timestamptz not null default now(), status text not null default 'reserved');
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY; REVOKE ALL ON public.challenges FROM anon,authenticated;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY; REVOKE ALL ON public.events FROM anon,authenticated;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY; REVOKE ALL ON public.members FROM anon,authenticated;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY; REVOKE ALL ON public.photos FROM anon,authenticated;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY; REVOKE ALL ON public.recipes FROM anon,authenticated;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY; REVOKE ALL ON public.reports FROM anon,authenticated;
ALTER TABLE public.shelves ENABLE ROW LEVEL SECURITY; REVOKE ALL ON public.shelves FROM anon,authenticated;
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY; REVOKE ALL ON public.sources FROM anon,authenticated;
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY; REVOKE ALL ON public.transfers FROM anon,authenticated;
ALTER TABLE public.versions ENABLE ROW LEVEL SECURITY; REVOKE ALL ON public.versions FROM anon,authenticated;
ALTER TABLE public.ai_jobs ENABLE ROW LEVEL SECURITY; REVOKE ALL ON public.ai_jobs FROM anon,authenticated;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES ('photos','photos',false,2097152,ARRAY['image/jpeg','image/png','image/webp']) ON CONFLICT(id) DO NOTHING;
