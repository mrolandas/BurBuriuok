-- seed_curriculum_dependencies.sql
-- Generated 2025-12-03T16:17:33.463Z

insert into burburiuok.curriculum_dependencies (
    source_type,
    source_concept_id,
    source_node_code,
    prerequisite_type,
    prerequisite_concept_id,
    prerequisite_node_code,
    notes,
    created_by
) values
    ('node', NULL, '2', 'node', NULL, '1', 'Buriavimo teorijai reikalingi konstrukcijos pagrindai.', 'seed_script'),
    ('node', NULL, '3', 'node', NULL, '1', 'Prieš valdymo praktiką supažindiname su įrangos ir korpuso sąvokomis.', 'seed_script'),
    ('node', NULL, '3', 'node', NULL, '2', 'Manevravimo technika remiasi aerodinaminiais principais.', 'seed_script'),
    ('node', NULL, '4', 'node', NULL, '3', 'Saugos moduliai atsiremia į praktinius situacijų scenarijus.', 'seed_script')

on conflict (source_node_code, prerequisite_node_code)
    where source_type = 'node' and prerequisite_type = 'node'
    do update set
    notes = excluded.notes,
    created_by = excluded.created_by;

