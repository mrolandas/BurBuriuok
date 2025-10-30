-- 0003_concepts_required_flag.sql
-- Adds a curriculum alignment flag to concepts so we can distinguish required vs optional knowledge.

alter table burburiuok.concepts
    add column if not exists is_required boolean not null default true;
