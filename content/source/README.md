# Content Source Files

This folder contains the authoritative source files for the LBS (sailing) curriculum demo content.

## Files

| File                         | Purpose                                                 |
| ---------------------------- | ------------------------------------------------------- |
| `LBS_programa.md`            | Official LBS curriculum program structure (Lithuanian)  |
| `LBS_concepts_master.md`     | Master list of all curriculum concepts with definitions |
| `curriculum_in_supabase.csv` | Generated snapshot of curriculum hierarchy in database  |

## Workflow

1. **Edit** `LBS_concepts_master.md` when adding/changing concepts
2. **Regenerate seeds**: `npm run content:seed:generate`
3. **Validate**: `npm run content:seed:check` (runs automatically on pre-commit)
4. **Snapshot**: `npm run content:snapshot:refresh` updates the CSV

## Notes

- `LBS_programa.md` is the official curriculum document and rarely changes
- `curriculum_in_supabase.csv` is auto-generated - don't edit manually
- All content scripts in `content/scripts/` reference these files
