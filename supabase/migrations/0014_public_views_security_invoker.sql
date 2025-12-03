-- 0014_public_views_security_invoker.sql
-- Switches public projection views to SECURITY INVOKER and grants the
-- minimum privileges required for client roles so Supabase no longer
-- reports the views as SECURITY DEFINER.

alter view public.burburiuok_concepts set (security_invoker = true);
alter view public.burburiuok_concept_progress set (security_invoker = true);
alter view public.burburiuok_curriculum_nodes set (security_invoker = true);
alter view public.burburiuok_curriculum_items set (security_invoker = true);

grant usage on schema burburiuok to anon, authenticated;

grant select on burburiuok.concepts to anon, authenticated;
grant select on burburiuok.concept_progress to anon, authenticated;
grant select on burburiuok.curriculum_nodes to anon, authenticated;
grant select on burburiuok.curriculum_items to anon, authenticated;
