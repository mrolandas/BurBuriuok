import { getSupabaseClient } from '../data/supabaseClient.js';

async function checkOrdinals() {
  const client = getSupabaseClient({ service: true, schema: 'burburiuok' });
  
  // Get concepts with their ordinals for a specific node
  const targetNode = 'LBS-1-1A';
  
  const { data: concepts, error } = await client
    .from('concepts')
    .select('slug, term_lt, curriculum_node_code, curriculum_item_ordinal, curriculum_item_label')
    .eq('curriculum_node_code', targetNode)
    .order('curriculum_item_ordinal');
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log(`\nConcepts in ${targetNode} (ordered by ordinal):`);
  concepts?.forEach((c: any) => {
    console.log(`  ord: ${c.curriculum_item_ordinal} | slug: ${c.slug} | term: ${c.term_lt}`);
  });
  
  // Check for gaps
  console.log('\nOrdinal analysis:');
  const ordinals = concepts?.map((c: any) => c.curriculum_item_ordinal) || [];
  console.log('  Ordinals:', ordinals.join(', '));
  
  const gaps = [];
  for (let i = 1; i < ordinals.length; i++) {
    if (ordinals[i] - ordinals[i-1] > 1) {
      gaps.push(`gap between ${ordinals[i-1]} and ${ordinals[i]}`);
    }
  }
  if (gaps.length) {
    console.log('  Gaps found:', gaps.join('; '));
  } else if (ordinals.length > 0) {
    console.log('  No gaps - ordinals are consecutive');
  }
  
  // Check if ordinals start at 1
  if (ordinals.length > 0 && ordinals[0] !== 1) {
    console.log(`  Warning: First ordinal is ${ordinals[0]}, not 1`);
  }
}

checkOrdinals().catch(console.error);
