#!/usr/bin/env ts-node

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import express from "express";
import type { Router } from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { getSupabaseClient, resetSupabaseClients } from "../data/supabaseClient.ts";
import settingsRouter from "../backend/src/routes/admin/settings.ts";
import contentRouter from "../backend/src/routes/admin/content.ts";
import curriculumRouter from "../backend/src/routes/admin/curriculum.ts";
import conceptsRouter from "../backend/src/routes/admin/concepts.ts";

// --- Env Loading ---
function loadEnv(): void {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) {
    return;
  }
  const contents = readFileSync(envPath, "utf8");
  contents.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const match = trimmed.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) return;
    const [, key, raw] = match;
    if (!process.env[key]) {
      process.env[key] = raw.replace(/^"|"$/g, "").replace(/^'|'$/g, "");
    }
  });
}

function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

// --- Server Setup ---
async function startServer(app: express.Application): Promise<{ server: Server; baseUrl: string }> {
  const server: Server = await new Promise((resolve) => {
    const listener = app.listen(0, () => resolve(listener));
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Could not determine server address");
  }
  const port = (address as AddressInfo).port;
  return { server, baseUrl: `http://127.0.0.1:${port}/api/v1/admin` };
}

function createTestApp(): express.Application {
  const app = express();
  app.use(express.json());
  // Mock Auth Middleware
  app.use((req, _res, next) => {
    (req as any).authUser = {
      id: null, // Use null to avoid FK constraint
      email: "admin@test.com",
      appRole: "admin",
    };
    next();
  });
  
  const router = express.Router();
  router.use("/settings", settingsRouter);
  router.use("/content", contentRouter);
  router.use("/curriculum", curriculumRouter);
  router.use("/concepts", conceptsRouter);
  
  app.use("/api/v1/admin", router);
  return app;
}

// --- Tests ---
async function main() {
  loadEnv();
  const supabase = getSupabaseClient({ service: true, schema: "burburiuok" }) as any;
  // Use anon client for frontend simulation to test RLS/Permissions
  const publicSupabase = getSupabaseClient({ service: false, schema: "public" }) as any;
  const app = createTestApp();
  const { server, baseUrl } = await startServer(app);

  console.log(`🚀 Test server running at ${baseUrl}`);

  try {
    // 1. Test Global Settings
    console.log("Testing Global Settings...");
    const settingsRes = await fetch(`${baseUrl}/settings/global`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appTitle: "Test App Title",
        primaryColor: "#ff0000",
        registrationEnabled: false
      })
    });
    expect(settingsRes.ok, "Failed to update global settings");
    const settingsData = await settingsRes.json();
    expect(settingsData.data.appTitle === "Test App Title", "App title mismatch");
    expect(settingsData.data.registrationEnabled === false, "Registration toggle mismatch");

    // 2. Test Content Reset
    console.log("Testing Content Reset...");
    // First create some dummy content to delete
    await supabase.from("curriculum_nodes").insert({
      code: "TEST-NODE",
      title: "Test Node",
      ordinal: 999
    });
    
    const resetRes = await fetch(`${baseUrl}/content/reset`, {
      method: "POST"
    });
    expect(resetRes.ok, "Failed to reset content");
    
    const { data: nodes } = await supabase.from("curriculum_nodes").select("*").eq("code", "TEST-NODE");
    expect(nodes?.length === 0, "Content reset failed to delete nodes");

    // 3. Test Curriculum Nodes (Create & List)
    console.log("Testing Curriculum Nodes...");
    
    // Create Physics Root
    const physicsRes = await fetch(`${baseUrl}/curriculum/nodes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "PHYSICS",
        title: "Physics",
        ordinal: 1
      })
    });
    expect(physicsRes.ok, "Failed to create Physics node");

    // Create Mechanics (Child of Physics)
    const mechanicsRes = await fetch(`${baseUrl}/curriculum/nodes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "MECHANICS",
        title: "Mechanics",
        parentCode: "PHYSICS",
        ordinal: 1
      })
    });
    expect(mechanicsRes.ok, "Failed to create Mechanics node");

    // Create Thermodynamics (Child of Physics)
    const thermoRes = await fetch(`${baseUrl}/curriculum/nodes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "THERMODYNAMICS",
        title: "Thermodynamics",
        parentCode: "PHYSICS",
        ordinal: 2
      })
    });
    expect(thermoRes.ok, "Failed to create Thermodynamics node");
    
    const listNodesRes = await fetch(`${baseUrl}/curriculum/nodes?view=all`);
    expect(listNodesRes.ok, "Failed to list nodes");
    const listNodesData = await listNodesRes.json();
    
    const physicsNode = listNodesData.data.nodes.find((n: any) => n.code === "PHYSICS");
    const mechanicsNode = listNodesData.data.nodes.find((n: any) => n.code === "MECHANICS");
    
    expect(physicsNode, "Physics node not found");
    expect(mechanicsNode, "Mechanics node not found");
    expect(mechanicsNode.parentCode === "PHYSICS", "Mechanics parent mismatch");

    // 4. Test Concepts (Upsert via PUT)
    console.log("Testing Concepts...");
    
    // Concept: Velocity (in Mechanics)
    const velocitySlug = "velocity";
    const velocityRes = await fetch(`${baseUrl}/concepts/${velocitySlug}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: velocitySlug,
        termLt: "Velocity",
        descriptionLt: "The rate of change of position of an object with respect to a frame of reference, and is a function of time.",
        sectionCode: "MECHANICS",
        sectionTitle: "Mechanics",
        isRequired: true,
        status: "published"
      })
    });
    expect(velocityRes.ok, "Failed to upsert Velocity concept");

    // Concept: Acceleration (in Mechanics)
    const accelerationSlug = "acceleration";
    const accelerationRes = await fetch(`${baseUrl}/concepts/${accelerationSlug}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: accelerationSlug,
        termLt: "Acceleration",
        descriptionLt: "The rate of change of the velocity of an object with respect to time.",
        sectionCode: "MECHANICS",
        sectionTitle: "Mechanics",
        isRequired: true,
        status: "published"
      })
    });
    expect(accelerationRes.ok, "Failed to upsert Acceleration concept");

    // Concept: Entropy (in Thermodynamics)
    const entropySlug = "entropy";
    const entropyRes = await fetch(`${baseUrl}/concepts/${entropySlug}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: entropySlug,
        termLt: "Entropy",
        descriptionLt: "A scientific concept as well as a measurable physical property that is most commonly associated with a state of disorder, randomness, or uncertainty.",
        sectionCode: "THERMODYNAMICS",
        sectionTitle: "Thermodynamics",
        isRequired: false,
        status: "draft"
      })
    });
    expect(entropyRes.ok, "Failed to upsert Entropy concept");

    // 5. Verify Frontend Data Access
    console.log("Testing Frontend Data Access...");
    
    // 5.1 Check Level 1 Nodes (Sections)
    const { data: sections, error: sectionsError } = await publicSupabase
      .from('burburiuok_curriculum_nodes')
      .select('code,title,summary,ordinal')
      .eq('level', 1)
      .order('ordinal', { ascending: true });
      
    expect(!sectionsError, `Frontend query 1 failed: ${sectionsError?.message}`);
    expect(sections?.length === 1, `Expected 1 section, found ${sections?.length}`);
    expect(sections[0].code === "PHYSICS", "Expected PHYSICS section");
    expect(sections[0].summary === null, "Expected PHYSICS summary to be null");

    // 5.2 Check All Nodes (Hierarchy)
    const { data: allNodes, error: allNodesError } = await publicSupabase
      .from('burburiuok_curriculum_nodes')
      .select('code,parent_code,level');
      
    expect(!allNodesError, `Frontend query 2 failed: ${allNodesError?.message}`);
    const physicsNodeDb = allNodes.find((n: any) => n.code === "PHYSICS");
    const mechanicsNodeDb = allNodes.find((n: any) => n.code === "MECHANICS");
    
    expect(physicsNodeDb.level === 1, `PHYSICS should be level 1, got ${physicsNodeDb.level}`);
    expect(mechanicsNodeDb.level === 2, `MECHANICS should be level 2, got ${mechanicsNodeDb.level}`);
    expect(mechanicsNodeDb.parent_code === "PHYSICS", "MECHANICS parent should be PHYSICS");

    // 5.3 Check Concepts
    const { data: concepts, error: conceptsError } = await publicSupabase
      .from('burburiuok_concepts')
      .select('slug,term_lt,section_code,curriculum_node_code');
      
    expect(!conceptsError, `Frontend query 3 failed: ${conceptsError?.message}`);
    const velocity = concepts.find((c: any) => c.slug === "velocity");
    expect(velocity, "Velocity concept not found in public view");
    expect(velocity.section_code === "MECHANICS", "Velocity section code mismatch");

    console.log("✅ Frontend data access verified");

    console.log("✅ All App Configuration API tests passed!");

  } finally {
    // Cleanup
    await supabase.from("concepts").delete().in("slug", ["velocity", "acceleration", "entropy"]);
    await supabase.from("curriculum_nodes").delete().in("code", ["THERMODYNAMICS", "MECHANICS"]);
    await supabase.from("curriculum_nodes").delete().eq("code", "PHYSICS");
    
    // Also clean up previous test artifacts if any
    await supabase.from("curriculum_nodes").delete().eq("code", "NEW-NODE");
    await supabase.from("curriculum_nodes").delete().eq("code", "TEST-NODE");
    await supabase.from("concepts").delete().eq("slug", "test-concept");
    
    resetSupabaseClients();
    server.close();
  }
}

main().catch((err) => {
  console.error("❌ Tests failed:", err);
  process.exit(1);
});
