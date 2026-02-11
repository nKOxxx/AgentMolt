-- Fix: Update memories with invalid org_id
UPDATE memories 
SET org_id = '00000000-0000-0000-0000-000000000001' 
WHERE org_id = '00000000-0000-0000-0000-000000000000' 
   OR org_id IS NULL;

-- Then retry agents migration
INSERT INTO agents (id, org_id, name, type, last_activity_at)
SELECT DISTINCT 
    m.agent_id,
    '00000000-0000-0000-0000-000000000001', -- Force to default org
    'Agent ' || SUBSTRING(m.agent_id::text, 1, 8),
    'ai-agent',
    MAX(m.created_at)
FROM memories m
WHERE m.agent_id NOT IN (SELECT id FROM agents)
GROUP BY m.agent_id;
