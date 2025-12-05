import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  db: { schema: "burburiuok" },
});

async function checkConstraints() {
  console.log("Checking constraints on concept_progress...");

  // This query is specific to Postgres to find check constraints
  const { data, error } = await supabase.rpc("get_constraints", {
    table_name: "concept_progress",
  });

  // Since we can't easily run arbitrary SQL via client without a function,
  // let's just try to insert a record with status 'seen' and see if it fails.

  const testId = "00000000-0000-0000-0000-000000000000"; // Assuming this ID doesn't exist or we can delete it

  // First, we need a valid concept ID. Let's pick one.
  const { data: concepts } = await supabase
    .from("concepts")
    .select("id")
    .limit(1);
  if (!concepts || concepts.length === 0) {
    console.log("No concepts to test with.");
    return;
  }
  const conceptId = concepts[0].id;
  const userId = "00000000-0000-0000-0000-000000000000"; // Fake user ID, might fail FK if users table checked.

  // Actually, let's just check if we can insert a row with status 'seen' for a dummy user if RLS allows or if we are service role.
  // We are service role.

  // We need a valid user ID if the column references auth.users.
  // The migration 0016 added user_id references auth.users.
  // So we need a real user or null user_id (if allowed? 0016 says `add column if not exists user_id uuid references auth.users (id) on delete cascade`).
  // It doesn't say NOT NULL.

  // But `device_key` was made nullable.

  // Let's try inserting with status 'seen' and see what happens.

  const { error: insertError } = await supabase
    .from("concept_progress")
    .insert({
      concept_id: conceptId,
      status: "seen",
      device_key: "test-device-key",
    });

  if (insertError) {
    console.log("Insert failed:", insertError.message);
    if (insertError.message.includes("check constraint")) {
      console.log("Constraint exists!");
    }
  } else {
    console.log("Insert successful! No check constraint on status values.");
    // Clean up
    await supabase
      .from("concept_progress")
      .delete()
      .eq("device_key", "test-device-key");
  }
}

checkConstraints();
