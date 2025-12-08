import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

// Load environment variables
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing required environment variables");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { db: { schema: 'burburiuok' } }) as any;

async function main() {
  console.log("🌱 Seeding demo content...");

  // 1. Create Physics Root
  const { error: physicsError } = await supabase.from("curriculum_nodes").upsert({
    code: "PHYSICS",
    title: "Physics",
    ordinal: 1,
    level: 1
  });
  if (physicsError) console.error("Error creating Physics:", physicsError);

  // 2. Create Mechanics
  const { error: mechanicsError } = await supabase.from("curriculum_nodes").upsert({
    code: "MECHANICS",
    title: "Mechanics",
    parent_code: "PHYSICS",
    ordinal: 1,
    level: 2
  });
  if (mechanicsError) console.error("Error creating Mechanics:", mechanicsError);

  // 3. Create Thermodynamics
  const { error: thermoError } = await supabase.from("curriculum_nodes").upsert({
    code: "THERMODYNAMICS",
    title: "Thermodynamics",
    parent_code: "PHYSICS",
    ordinal: 2,
    level: 2
  });
  if (thermoError) console.error("Error creating Thermodynamics:", thermoError);

  // 3.1 Create Kinematics (Level 3 under Mechanics)
  const { error: kinematicsError } = await supabase.from("curriculum_nodes").upsert({
    code: "KINEMATICS",
    title: "Kinematics",
    parent_code: "MECHANICS",
    ordinal: 1,
    level: 3
  });
  if (kinematicsError) console.error("Error creating Kinematics:", kinematicsError);

  // 4. Create Concepts
  const concepts = [
    {
      slug: "velocity",
      term_lt: "Velocity",
      description_lt: "The rate of change of position.",
      section_code: "MECHANICS", // Legacy field, keeping for safety
      curriculum_node_code: "MECHANICS",
      is_required: true,
      metadata: { status: "published" }
    },
    {
      slug: "acceleration",
      term_lt: "Acceleration",
      description_lt: "The rate of change of velocity.",
      section_code: "MECHANICS",
      curriculum_node_code: "MECHANICS",
      is_required: true,
      metadata: { status: "published" }
    },
    {
      slug: "entropy",
      term_lt: "Entropy",
      description_lt: "A measure of disorder.",
      section_code: "THERMODYNAMICS",
      curriculum_node_code: "THERMODYNAMICS",
      is_required: false,
      metadata: { status: "draft" }
    },
    {
      slug: "displacement",
      term_lt: "Displacement",
      description_lt: "Change in position.",
      section_code: "KINEMATICS",
      curriculum_node_code: "KINEMATICS",
      is_required: true,
      metadata: { status: "published" }
    }
  ];

  for (const c of concepts) {
    const { error } = await supabase.from("concepts").upsert(c, { onConflict: 'slug' });
    if (error) console.error(`Error creating concept ${c.slug}:`, error);
  }

  // 5. Create Curriculum Items (Labels)
  // This table links nodes to concepts via ordinal/label, or just defines the structure
  const items = [
    { node_code: "MECHANICS", ordinal: 1, label: "Velocity" },
    { node_code: "MECHANICS", ordinal: 2, label: "Acceleration" },
    { node_code: "THERMODYNAMICS", ordinal: 1, label: "Entropy" },
    { node_code: "KINEMATICS", ordinal: 1, label: "Displacement" }
  ];

  for (const item of items) {
    const { error } = await supabase.from("curriculum_items").upsert(item);
    if (error) console.error(`Error creating item for ${item.node_code}:`, error);
  }

  // 6. Link Concepts to Items (via ordinal)
  // We need to update the concepts to have the correct ordinal matching the item
  // Note: The previous upsert might have left curriculum_item_ordinal null
  
  const conceptUpdates = [
    { slug: "velocity", curriculum_item_ordinal: 1 },
    { slug: "acceleration", curriculum_item_ordinal: 2 },
    { slug: "entropy", curriculum_item_ordinal: 1 },
    { slug: "displacement", curriculum_item_ordinal: 1 }
  ];

  for (const update of conceptUpdates) {
    const { error } = await supabase
      .from("concepts")
      .update({ curriculum_item_ordinal: update.curriculum_item_ordinal })
      .eq("slug", update.slug);
      
    if (error) console.error(`Error linking concept ${update.slug}:`, error);
  }


  console.log("✅ Demo content seeded!");
}

main().catch(console.error);
