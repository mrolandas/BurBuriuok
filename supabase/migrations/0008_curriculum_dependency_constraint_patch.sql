-- 0008_curriculum_dependency_constraint_patch.sql
-- Reasserts unique constraints for curriculum dependency edges to support seed upserts.

create unique index if not exists curriculum_dependencies_concept_to_concept_uniq
    on burburiuok.curriculum_dependencies (source_concept_id, prerequisite_concept_id)
    where source_type = 'concept' and prerequisite_type = 'concept';

create unique index if not exists curriculum_dependencies_node_to_node_uniq
    on burburiuok.curriculum_dependencies (source_node_code, prerequisite_node_code)
    where source_type = 'node' and prerequisite_type = 'node';
