alter table public.ai_jobs add column model text not null default 'gemini-3.6-flash';
create index ai_jobs_model_created_at_idx on public.ai_jobs(model,created_at desc);
