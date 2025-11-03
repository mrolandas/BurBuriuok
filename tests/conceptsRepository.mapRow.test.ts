import { mapConceptRow } from "../data/repositories/conceptsMapper.ts";

function expect(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

const required = mapConceptRow({
  section_code: "1",
  slug: "req",
  term_lt: "Term Required",
  is_required: true,
});
expect(required.isRequired === true, "Expected concepts with is_required=true to map as required");

const optionalMissingFlag = mapConceptRow({
  section_code: "1",
  slug: "opt-missing",
  term_lt: "Term Optional",
});
expect(optionalMissingFlag.isRequired === false, "Expected missing flag to map as optional");

const optionalFalseFlag = mapConceptRow({
  section_code: "1",
  slug: "opt-false",
  term_lt: "Term Optional False",
  is_required: false,
});
expect(optionalFalseFlag.isRequired === false, "Expected is_required=false to map as optional");

console.log("✅ conceptsRepository mapRow handles is_required flag correctly");
