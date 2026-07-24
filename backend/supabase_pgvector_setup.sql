-- Run once in the Supabase SQL Editor to replace local ChromaDB with pgvector.

create extension if not exists vector;

create table if not exists resume_chunks (
  id bigint generated always as identity primary key,
  file_id text not null,
  filename text not null,
  chunk_index int not null,
  content text not null,
  embedding vector(384) not null,
  created_at timestamptz not null default now()
);

create index if not exists resume_chunks_file_id_idx on resume_chunks (file_id);

create or replace function match_resume_chunks (
  query_embedding vector(384),
  match_file_id text,
  match_count int default 5
)
returns table (
  id bigint,
  content text
)
language sql stable
as $$
  select resume_chunks.id, resume_chunks.content
  from resume_chunks
  where resume_chunks.file_id = match_file_id
  order by resume_chunks.embedding <=> query_embedding
  limit match_count;
$$;
