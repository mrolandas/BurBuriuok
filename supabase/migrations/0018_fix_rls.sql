-- Enable RLS on tables
ALTER TABLE burburiuok.curriculum_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE burburiuok.curriculum_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE burburiuok.concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE burburiuok.concept_progress ENABLE ROW LEVEL SECURITY;

-- Policies for Curriculum Nodes (Public Read)
CREATE POLICY "Public read access for curriculum_nodes"
ON burburiuok.curriculum_nodes FOR SELECT
USING (true);

-- Policies for Curriculum Items (Public Read)
CREATE POLICY "Public read access for curriculum_items"
ON burburiuok.curriculum_items FOR SELECT
USING (true);

-- Policies for Concepts (Public Read)
CREATE POLICY "Public read access for concepts"
ON burburiuok.concepts FOR SELECT
USING (true);

-- Policies for Concept Progress
-- Users can see their own progress
CREATE POLICY "Users can view their own progress"
ON burburiuok.concept_progress FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own progress
CREATE POLICY "Users can insert their own progress"
ON burburiuok.concept_progress FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own progress
CREATE POLICY "Users can update their own progress"
ON burburiuok.concept_progress FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own progress
CREATE POLICY "Users can delete their own progress"
ON burburiuok.concept_progress FOR DELETE
USING (auth.uid() = user_id);
