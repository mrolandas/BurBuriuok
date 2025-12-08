
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load env
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_URL = 'http://localhost:4000'; // Assuming backend is running here

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing env vars:");
    if (!SUPABASE_URL) console.error("- SUPABASE_URL");
    if (!SUPABASE_SERVICE_ROLE_KEY) console.error("- SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) as any;

async function getAdminToken() {
    const email = "info@cit.lt";
    const password = "temp-password-" + Date.now();
    
    console.log(`🔍 Looking up user: ${email}`);
    const { data: { users } } = await supabase.auth.admin.listUsers();
    const user = users.find((u: any) => u.email === email);
    
    if (!user) {
        // Create user if not exists
        console.log(`Creating user ${email}...`);
        const { data: newUser, error } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            app_metadata: { app_role: 'admin' }
        });
        if (error) throw error;
        console.log("User created.");
    } else {
        // Update password and ensure admin role
        console.log(`Updating user ${email}...`);
        await supabase.auth.admin.updateUserById(user.id, {
            password: password,
            app_metadata: { ...user.app_metadata, app_role: 'admin' }
        });
    }

    // Sign in to get token
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (error) throw error;
    return data.session.access_token;
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

function parseMarkdown(content: string) {
    const lines = content.split('\n');
    const sections: any[] = [];
    let currentSection: any = null;
    let currentSubsection: any = null;
    const usedSlugs = new Set<string>();

    for (const line of lines) {
        // Level 1 Section: ## 1. TITLE
        const sectionMatch = line.match(/^##\s+(\d+\.?)\s+(.*)$/);
        if (sectionMatch) {
            const code = `LBS-${sectionMatch[1].replace(/\./g, '')}`;
            currentSection = {
                code,
                title: sectionMatch[2].trim(),
                level: 1,
                ordinal: parseInt(sectionMatch[1]),
                children: []
            };
            sections.push(currentSection);
            currentSubsection = null;
            continue;
        }

        // Level 2 Subsection: ### 1.1a TITLE or ### 1.1.1 TITLE
        const subMatch = line.match(/^###\s+(\S+)\s+(.*)$/);
        if (subMatch) {
            if (!currentSection) continue;
            const rawCode = subMatch[1];
            const cleanCode = rawCode.replace(/\./g, '-').toUpperCase();
            const code = `LBS-${cleanCode}`;
            
            currentSubsection = {
                code,
                title: subMatch[2].trim(),
                level: 2,
                parent_code: currentSection.code,
                ordinal: sections.length * 100 + currentSection.children.length + 1, // Simple ordinal strategy
                concepts: []
            };
            currentSection.children.push(currentSubsection);
            continue;
        }

        // Table Row: | Term LT | Term EN | Def |
        const rowMatch = line.match(/^\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|$/);
        if (rowMatch) {
            // Skip header separator lines
            if (line.includes('---')) continue;
            // Skip header row
            if (rowMatch[1].includes('Sąvoka LT')) continue;

            if (!currentSubsection) continue;

            const termLt = rowMatch[1].trim();
            const termEn = rowMatch[2].trim();
            const def = rowMatch[3].trim();
            
            // Generate slug from EN term if present, else LT term
            let slugBase = termEn || termLt;
            let slug = slugBase.toLowerCase()
                .replace(/ą/g, 'a').replace(/č/g, 'c').replace(/ę/g, 'e')
                .replace(/ė/g, 'e').replace(/į/g, 'i').replace(/š/g, 's')
                .replace(/ų/g, 'u').replace(/ū/g, 'u').replace(/ž/g, 'z')
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '');

            if (usedSlugs.has(slug)) {
                // Try appending LT term
                const suffix = termLt.toLowerCase()
                    .replace(/ą/g, 'a').replace(/č/g, 'c').replace(/ę/g, 'e')
                    .replace(/ė/g, 'e').replace(/į/g, 'i').replace(/š/g, 's')
                    .replace(/ų/g, 'u').replace(/ū/g, 'u').replace(/ž/g, 'z')
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-|-$/g, '');
                slug = `${slug}-${suffix}`;
            }
            
            if (usedSlugs.has(slug)) {
                 // Fallback to random suffix if still duplicate
                 slug = `${slug}-${Math.floor(Math.random() * 1000)}`;
            }

            usedSlugs.add(slug);

            currentSubsection.concepts.push({
                slug,
                termLt,
                termEn,
                descriptionLt: def,
                sectionCode: currentSubsection.code,
                sectionTitle: currentSubsection.title,
                isRequired: true,
                status: 'published'
            });
        }
    }
    return sections;
}

async function main() {
    try {
        console.log("🔑 Generating Admin Token...");
        const token = await getAdminToken();
        
        console.log("🧹 Resetting Content...");
        await apiRequest('POST', '/api/v1/admin/content/reset', token);

        console.log("📖 Reading and Parsing Markdown...");
        const mdContent = fs.readFileSync(path.resolve(process.cwd(), 'docs/static_info/LBS_concepts_master.md'), 'utf-8');
        const sections = parseMarkdown(mdContent);

        console.log(`Found ${sections.length} sections.`);

        for (const section of sections) {
            console.log(`Processing Section: ${section.title} (${section.code})`);
            
            // Create Section
            await apiRequest('POST', `/api/v1/admin/curriculum/nodes`, token, {
                code: section.code,
                title: section.title,
                ordinal: section.ordinal
            });

            for (const sub of section.children) {
                console.log(`  Processing Subsection: ${sub.title} (${sub.code})`);
                
                // Create Subsection
                await apiRequest('POST', `/api/v1/admin/curriculum/nodes`, token, {
                    code: sub.code,
                    title: sub.title,
                    parentCode: section.code,
                    ordinal: sub.ordinal
                });

                // Create Concepts
                for (const concept of sub.concepts) {
                    process.stdout.write(`    Creating Concept: ${concept.slug}\r`);
                    await apiRequest('POST', `/api/v1/admin/concepts`, token, concept);
                }
                console.log(`    ✅ Created ${sub.concepts.length} concepts.`);
            }
        }

        console.log("\n✨ Import Complete!");

    } catch (e) {
        console.error("Error:", e);
        process.exit(1);
    }
}

main();
