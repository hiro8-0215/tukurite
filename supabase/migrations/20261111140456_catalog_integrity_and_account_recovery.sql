-- Preserve existing originals. Deployment must stop if existing duplicates need resolution.
CREATE UNIQUE INDEX recipes_published_hash_unique ON public.recipes(hash) WHERE status='published';
CREATE INDEX recipes_public_page ON public.recipes(created DESC,id DESC) WHERE status='published';
CREATE INDEX recipes_owner_page ON public.recipes(owner,created DESC,id DESC);
CREATE INDEX shelves_owner_recipe ON public.shelves("user",recipe);

CREATE TABLE public.account_security (
 owner uuid PRIMARY KEY,
 login_id text UNIQUE NOT NULL,
 code_hash text,
 pending_hash text,
 pending_expires timestamptz,
 revoked_before timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.request_limits (
 key text PRIMARY KEY,
 window_start timestamptz NOT NULL DEFAULT now(),
 attempts integer NOT NULL CHECK(attempts>0)
);
ALTER TABLE public.account_security ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_security,public.request_limits FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.account_security,public.request_limits TO service_role;
