CREATE TABLE public.follows (
  follower text NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  following text NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(follower,following),
  CHECK (follower<>following)
);
CREATE INDEX follows_by_author ON public.follows(following,created_at DESC);

CREATE TABLE public.cook_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner text NOT NULL REFERENCES public.members(id),
  recipe text NOT NULL REFERENCES public.recipes(id),
  photo text NOT NULL REFERENCES public.photos(id),
  caption text NOT NULL DEFAULT '' CHECK(length(caption)<=1000),
  day date NOT NULL,
  status text NOT NULL DEFAULT 'published' CHECK(status IN ('published','archived')),
  sample boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX cook_post_once_daily ON public.cook_posts(owner,recipe,day) WHERE status='published';
CREATE INDEX cook_posts_recipe_created ON public.cook_posts(recipe,created_at DESC);
CREATE INDEX cook_posts_owner_created ON public.cook_posts(owner,created_at DESC);
CREATE INDEX cook_posts_photo ON public.cook_posts(photo);
CREATE INDEX cook_posts_feed ON public.cook_posts(created_at DESC) WHERE status='published';

CREATE TABLE public.cook_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post uuid NOT NULL REFERENCES public.cook_posts(id),
  owner text NOT NULL REFERENCES public.members(id),
  body text NOT NULL CHECK(length(trim(body)) BETWEEN 1 AND 400),
  status text NOT NULL DEFAULT 'published' CHECK(status IN ('published','archived')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cook_comments_post_created ON public.cook_comments(post,created_at);
CREATE INDEX cook_comments_owner_created ON public.cook_comments(owner,created_at DESC);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient text NOT NULL REFERENCES public.members(id),
  actor text NOT NULL REFERENCES public.members(id),
  kind text NOT NULL CHECK(kind IN ('follow','recipe','save','cook','comment')),
  recipe text REFERENCES public.recipes(id),
  post uuid REFERENCES public.cook_posts(id),
  entity_key text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(recipient,kind,entity_key),
  CHECK(recipient<>actor)
);
CREATE INDEX notifications_recipient_created ON public.notifications(recipient,created_at DESC);
CREATE INDEX notifications_unread ON public.notifications(recipient) WHERE read_at IS NULL;
CREATE INDEX notifications_actor ON public.notifications(actor);
CREATE INDEX notifications_recipe ON public.notifications(recipe);
CREATE INDEX notifications_post ON public.notifications(post);

CREATE SEQUENCE public.recipe_draft_revision_seq;
REVOKE ALL ON SEQUENCE public.recipe_draft_revision_seq FROM anon,authenticated;
GRANT USAGE,SELECT ON SEQUENCE public.recipe_draft_revision_seq TO service_role;
CREATE TABLE public.recipe_drafts (
  owner text NOT NULL REFERENCES public.members(id),
  draft_key text NOT NULL CHECK(length(draft_key) BETWEEN 1 AND 100),
  payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object' AND octet_length(payload::text)<=30000),
  revision bigint NOT NULL DEFAULT nextval('public.recipe_draft_revision_seq') CHECK(revision>0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(owner,draft_key)
);
ALTER SEQUENCE public.recipe_draft_revision_seq OWNED BY public.recipe_drafts.revision;

CREATE TABLE public.recipe_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner text NOT NULL REFERENCES public.members(id),
  source_recipe text NOT NULL REFERENCES public.recipes(id),
  source_version integer NOT NULL,
  source_hash text NOT NULL,
  payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object' AND octet_length(payload::text)<=30000),
  preferences text NOT NULL DEFAULT '' CHECK(length(preferences)<=1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX recipe_variants_owner_created ON public.recipe_variants(owner,created_at DESC);
CREATE INDEX recipe_variants_source ON public.recipe_variants(source_recipe);

CREATE TABLE public.meal_plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner text NOT NULL REFERENCES public.members(id),
  plan_day date NOT NULL,
  slot text NOT NULL CHECK(slot IN ('朝','昼','夜')),
  source_kind text NOT NULL CHECK(source_kind IN ('recipe','shelf','variant')),
  source_id text NOT NULL,
  snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object' AND octet_length(snapshot::text)<=30000),
  servings integer NOT NULL CHECK(servings BETWEEN 1 AND 100),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX meal_plan_owner_day ON public.meal_plan_items(owner,plan_day,slot);

CREATE TABLE public.shopping_checks (
  owner text NOT NULL REFERENCES public.members(id),
  week date NOT NULL,
  item_key text NOT NULL CHECK(length(item_key) BETWEEN 1 AND 200),
  checked boolean NOT NULL DEFAULT true,
  PRIMARY KEY(owner,week,item_key)
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['follows','cook_posts','cook_comments','notifications','recipe_drafts','recipe_variants','meal_plan_items','shopping_checks'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon,authenticated',t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
  END LOOP;
END $$;
