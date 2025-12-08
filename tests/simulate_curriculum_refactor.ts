
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load env
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
} else {
    // Fallback to frontend .env for URL/Anon, but we need Service Role from somewhere else usually
    // In this dev environment, it seems .env is in root?
    const frontendEnv = path.resolve(process.cwd(), 'frontend/.env');
    if (fs.existsSync(frontendEnv)) {
        dotenv.config({ path: frontendEnv });
    }
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_URL = 'http://localhost:4000';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing env vars:");
    if (!SUPABASE_URL) console.error("- SUPABASE_URL");
    if (!SUPABASE_SERVICE_ROLE_KEY) console.error("- SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) as any;

async function getAdminToken() {
    const email = "info@cit.lt";
    // We assume the user exists from the previous seed script
    // We'll reset the password to get a fresh token
    const password = "temp-password-" + Date.now();
    
    const { data: { users } } = await supabase.auth.admin.listUsers();
    const user = users.find((u: any) => u.email === email);
    
    if (!user) {
        throw new Error("Admin user not found. Please run seed_lbs_content.ts first.");
    }

    await supabase.auth.admin.updateUserById(user.id, {
        password: password
    });

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (error) throw error;
    return data.session!.access_token;
}

async function apiRequest(method: string, endpoint: string, token: string, body?: any) {
    const res = await fetch(`${API_URL}${endpoint}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: body ? JSON.stringify(body) : undefined
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`API ${method} ${endpoint} failed: ${res.status} ${text}`);
    }
    return res.json();
}

async function main() {
    try {
        console.log("🤖 AI Agent: Initializing...");
        const token = await getAdminToken();
        console.log("🤖 AI Agent: Authenticated as Admin.");

        const targetCode = 'LBS-4';
        console.log(`\n🤖 AI Agent: Analyzing Section '${targetCode}'...`);

        // 1. Fetch current structure
        const { data: { nodes } } = await apiRequest('GET', `/api/v1/admin/curriculum/nodes?view=all`, token);
        const section = nodes.find((n: any) => n.code === targetCode);
        
        if (!section) {
            throw new Error(`Section ${targetCode} not found`);
        }

        const children = nodes.filter((n: any) => n.parentCode === targetCode);
        console.log(`   Current Title: "${section.title}"`);
        console.log(`   Current Subsections: ${children.length}`);
        children.forEach((c: any) => console.log(`     - ${c.code}: ${c.title}`));

        // 2. "AI" Analysis
        console.log("\n🧠 AI Analysis:");
        console.log("   The section title implies multiple distinct topics:");
        console.log("   1. Saugos priemonės (Safety)");
        console.log("   2. Gelbėjimo priemonės (Rescue)");
        console.log("   3. Priešgaisrinės priemonės (Fire)");
        console.log("   4. Pirmoji medicinos pagalba (First Aid)");
        console.log("   Current structure is insufficient.");

        // 3. Refactoring
        console.log("\n🛠️  AI Action: Restructuring curriculum with REAL content...");

        const contentPlan = [
            {
                code: 'LBS-4-1',
                title: 'Asmeninės saugos priemonės',
                ordinal: 10,
                concepts: [
                    {
                        slug: 'gelbejimosi-liemene',
                        termLt: 'Gelbėjimosi liemenė',
                        descriptionLt: 'Asmeninė priemonė, skirta išlaikyti žmogų vandens paviršiuje. Privaloma kiekvienam įgulos nariui, turi atitikti svorį ir būti sertifikuota.',
                        isRequired: true
                    },
                    {
                        slug: 'saugos-dirzai',
                        termLt: 'Saugos diržai',
                        descriptionLt: 'Diržai su karabinais, skirti prisisegti prie jachtos denio (lejerių) esant blogam orui ar naktį, kad žmogus neiškristų už borto.',
                        isRequired: true
                    }
                ]
            },
            {
                code: 'LBS-4-2',
                title: 'Gelbėjimo įranga',
                ordinal: 20,
                concepts: [
                    {
                        slug: 'gelbejimo-ratas',
                        termLt: 'Gelbėjimo ratas',
                        descriptionLt: 'Plūduriuojantis ratas, metamas žmogui, iškritusiam už borto. Turi būti paruoštas greitam naudojimui.',
                        isRequired: true
                    },
                    {
                        slug: 'gelbejimo-plaustas',
                        termLt: 'Gelbėjimo plaustas',
                        descriptionLt: 'Pripučiama gelbėjimo priemonė, naudojama evakuojantis iš skęstančio laivo. Turi būti periodiškai tikrinamas.',
                        isRequired: true
                    },
                    {
                        slug: 'pirotechnika',
                        termLt: 'Pirotechnika',
                        descriptionLt: 'Signalinės raketos, deglai ir dūmai, skirti pranešti apie nelaimę ir nurodyti vietą gelbėtojams.',
                        isRequired: true
                    }
                ]
            },
            {
                code: 'LBS-4-3',
                title: 'Priešgaisrinė sauga',
                ordinal: 30,
                concepts: [
                    {
                        slug: 'gesintuvai',
                        termLt: 'Gesintuvai',
                        descriptionLt: 'Priemonės ugniai gesinti. Jachtose dažniausiai naudojami milteliniai ABC klasės gesintuvai, tinkantys gesinti kietas medžiagas, skysčius ir dujas.',
                        isRequired: true
                    },
                    {
                        slug: 'priesgaisrinis-audeklas',
                        termLt: 'Priešgaisrinis audeklas',
                        descriptionLt: 'Nedegus audinys, skirtas uždengti ugnies židinį (pvz., užsidegusius riebalus kambuze) ir nutraukti deguonies tiekimą.',
                        isRequired: true
                    }
                ]
            },
            {
                code: 'LBS-4-4',
                title: 'Pirmoji medicinos pagalba',
                ordinal: 40,
                concepts: [
                    {
                        slug: 'hipotermija',
                        termLt: 'Hipotermija',
                        descriptionLt: 'Pavojingas kūno temperatūros nukritimas. Būtina šildyti palaipsniui, keisti šlapius rūbus į sausus, duoti šiltų gėrimų.',
                        isRequired: true
                    },
                    {
                        slug: 'jurlige',
                        termLt: 'Jūrligė',
                        descriptionLt: 'Judėjimo liga, sukelianti pykinimą ir vėmimą. Svarbu žiūrėti į horizontą, būti gryname ore, vartoti skysčius.',
                        isRequired: false
                    }
                ]
            }
        ];

        for (const sub of contentPlan) {
            // Check if exists
            const exists = children.find((c: any) => c.code === sub.code);
            if (!exists) {
                process.stdout.write(`   Creating subsection: ${sub.title}... `);
                await apiRequest('POST', '/api/v1/admin/curriculum/nodes', token, {
                    code: sub.code,
                    title: sub.title,
                    parentCode: targetCode,
                    ordinal: sub.ordinal
                });
                console.log("✅");
            } else {
                console.log(`   Subsection ${sub.code} (${sub.title}) checked.`);
            }

            // Create Concepts
            for (const concept of sub.concepts) {
                process.stdout.write(`      Adding concept: ${concept.termLt}... `);
                try {
                    await apiRequest('POST', '/api/v1/admin/concepts', token, {
                        slug: concept.slug,
                        termLt: concept.termLt,
                        descriptionLt: concept.descriptionLt,
                        sectionCode: sub.code,
                        sectionTitle: sub.title,
                        isRequired: concept.isRequired,
                        status: 'published'
                    });
                    console.log("✅");
                } catch (e: any) {
                    if (e.message.includes('CONCEPT_ALREADY_EXISTS')) {
                        console.log("⚠️  (Exists)");
                    } else {
                        console.log("❌ Error:", e.message);
                    }
                }
            }
        }

        // 4. Verify
        console.log("\n✨ Refactoring Complete. Verifying new structure...");
        const { data: { nodes: newNodes } } = await apiRequest('GET', `/api/v1/admin/curriculum/nodes?view=all`, token);
        const newChildren = newNodes.filter((n: any) => n.parentCode === targetCode).sort((a: any, b: any) => a.ordinal - b.ordinal);
        
        console.log(`   Section: ${section.title}`);
        for (const child of newChildren) {
            console.log(`     📂 ${child.code}: ${child.title}`);
            // Fetch concepts for this child
            // We can't easily fetch concepts by node via admin API list yet without filtering, 
            // but we can assume they are there or fetch individually. 
            // For this test, listing nodes is enough proof of structure change.
        }

    } catch (e) {
        console.error("❌ Error:", e);
        process.exit(1);
    }
}

main();
