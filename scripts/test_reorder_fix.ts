import { reorderCurriculumItemAdmin, createCurriculumItemAdmin, deleteCurriculumItemAdminBySlug } from '../data/repositories/curriculumRepository.js';
import { getSupabaseClient } from '../data/supabaseClient.js';

async function checkOrdinals(label: string) {
  const client = getSupabaseClient({ service: true, schema: 'burburiuok' });
  const { data: concepts } = await client
    .from('concepts')
    .select('slug, term_lt, curriculum_item_ordinal')
    .eq('curriculum_node_code', 'LBS-1-1A')
    .order('curriculum_item_ordinal');

  console.log(`\n${label}:`);
  const ordinals: number[] = [];
  concepts?.forEach((c: any) => {
    console.log(`  ord ${c.curriculum_item_ordinal}: ${c.term_lt}`);
    ordinals.push(c.curriculum_item_ordinal);
  });
  
  // Check for gaps
  const gaps = [];
  for (let i = 0; i < ordinals.length - 1; i++) {
    if (ordinals[i + 1] - ordinals[i] > 1) {
      gaps.push(`gap between ${ordinals[i]} and ${ordinals[i + 1]}`);
    }
  }
  if (gaps.length > 0) {
    console.log(`  GAPS: ${gaps.join(', ')}`);
  } else {
    console.log(`  No gaps - ordinals are sequential`);
  }
}

async function testCreateWithOrdinal() {
  await checkOrdinals('BEFORE create');

  try {
    // Create a new concept at position 2 (should push others down)
    const result = await createCurriculumItemAdmin({ 
      nodeCode: 'LBS-1-1A',
      label: 'Test Insert',
      termLt: 'Testinis įterpimas',
      targetOrdinal: 2  // Insert at position 2
    });
    console.log(`\nCreated. ${result.concept.termLt} is at ordinal ${result.item.ordinal}`);
  } catch (e: any) {
    console.log('Error:', e.message);
    console.log(e.stack);
  }

  await checkOrdinals('AFTER create at position 2');
  
  // Clean up - delete the test concept
  try {
    await deleteCurriculumItemAdminBySlug('testinis-iterpimas');
    console.log('\nCleanup: deleted test concept');
  } catch (e: any) {
    console.log('Cleanup error:', e.message);
  }
  
  await checkOrdinals('AFTER cleanup');
}

testCreateWithOrdinal();
