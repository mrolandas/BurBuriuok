/// <reference path="../shims.d.ts" />

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "../supabaseClient.ts";
import type {
  CurriculumDependency,
  CurriculumDependencyRow,
  DependencyEntityType,
} from "../types.ts";

const TABLE = "curriculum_dependencies";

type DependencyQueryOptions = {
  sourceType?: DependencyEntityType;
  sourceNodeCode?: string;
  sourceConceptId?: string;
  prerequisiteType?: DependencyEntityType;
  prerequisiteNodeCode?: string;
  prerequisiteConceptId?: string;
};

function mapDependencyRow(row: CurriculumDependencyRow): CurriculumDependency {
  return {
    id: row.id,
    source: {
      type: row.source_type,
      conceptId: row.source_concept_id,
      nodeCode: row.source_node_code,
    },
    prerequisite: {
      type: row.prerequisite_type,
      conceptId: row.prerequisite_concept_id,
      nodeCode: row.prerequisite_node_code,
    },
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export async function listDependencies(
  client: SupabaseClient | null = null,
  options: DependencyQueryOptions = {}
): Promise<CurriculumDependency[]> {
  const supabase = client ?? getSupabaseClient();
  let query = (supabase as any)
    .from(TABLE)
    .select("*")
    .order("source_type", { ascending: true })
    .order("source_node_code", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true });

  if (options.sourceType) {
    query = query.eq("source_type", options.sourceType);
  }

  if (options.sourceNodeCode) {
    query = query.eq("source_node_code", options.sourceNodeCode);
  }

  if (options.sourceConceptId) {
    query = query.eq("source_concept_id", options.sourceConceptId);
  }

  if (options.prerequisiteType) {
    query = query.eq("prerequisite_type", options.prerequisiteType);
  }

  if (options.prerequisiteNodeCode) {
    query = query.eq(
      "prerequisite_node_code",
      options.prerequisiteNodeCode
    );
  }

  if (options.prerequisiteConceptId) {
    query = query.eq(
      "prerequisite_concept_id",
      options.prerequisiteConceptId
    );
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch curriculum dependencies: ${error.message}`);
  }

  return (data ?? []).map(mapDependencyRow);
}
