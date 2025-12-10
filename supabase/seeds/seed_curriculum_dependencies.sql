-- seed_curriculum_dependencies.sql
-- Generated 2025-12-10T08:06:42.650Z

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
    ('node', NULL, 'LBS-2', 'node', NULL, 'LBS-1', 'Buriavimo teorijai reikalingi konstrukcijos pagrindai.', 'seed_script'),
    ('node', NULL, 'LBS-3', 'node', NULL, 'LBS-1', 'Prieš valdymo praktiką supažindiname su įrangos ir korpuso sąvokomis.', 'seed_script'),
    ('node', NULL, 'LBS-3', 'node', NULL, 'LBS-2', 'Manevravimo technika remiasi aerodinaminiais principais.', 'seed_script'),
    ('node', NULL, 'LBS-4', 'node', NULL, 'LBS-3', 'Saugos moduliai atsiremia į praktinius situacijų scenarijus.', 'seed_script')

on conflict (source_node_code, prerequisite_node_code)
    where source_type = 'node' and prerequisite_type = 'node'
    do update set
    notes = excluded.notes,
    created_by = excluded.created_by;

