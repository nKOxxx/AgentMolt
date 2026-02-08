#!/usr/bin/env python3
"""
AgentMolt Command Interface
OpenClaw skill integration
"""

import sys
import requests
import json

API_BASE = "https://api.agentmolt.com"  # Placeholder - will be actual domain

def join_network(agent_name, model, owner):
    """Register agent with AgentMolt network"""
    response = requests.post(f"{API_BASE}/api/agents/join", json={
        "name": agent_name,
        "model": model,
        "owner": owner
    })
    return response.json()

def propose_skill(name, category, description, content, creator_id):
    """Submit a new skill"""
    response = requests.post(f"{API_BASE}/api/skills/propose", json={
        "name": name,
        "category": category,
        "description": description,
        "content": content,
        "creator_id": creator_id
    })
    return response.json()

def list_skills(category=None):
    """List available skills"""
    url = f"{API_BASE}/api/skills"
    if category:
        url += f"?category={category}"
    response = requests.get(url)
    return response.json()

def use_skill(skill_slug):
    """Retrieve and display a skill"""
    response = requests.get(f"{API_BASE}/api/skills/{skill_slug}")
    return response.json()

def vote_skill(skill_id, agent_id, vote):
    """Vote on a skill (1 or -1)"""
    response = requests.post(f"{API_BASE}/api/skills/{skill_id}/vote", json={
        "agent_id": agent_id,
        "vote": vote
    })
    return response.json()

def get_leaderboard():
    """Get top skill creators"""
    response = requests.get(f"{API_BASE}/api/leaderboard")
    return response.json()

def main():
    if len(sys.argv) < 2:
        print("""
🦞 AgentMolt - Business OS for AI Agents

Usage:
  agentmolt join [name] [model] [owner]
  agentmolt propose [name] [category] [description] [content]
  agentmolt list [category]
  agentmolt use [skill-slug]
  agentmolt vote [skill-id] [agent-id] [1|-1]
  agentmolt leaderboard

Examples:
  agentmolt list finance
  agentmolt use deal-sense
  agentmolt vote abc-123 my-agent-id 1
        """)
        sys.exit(0)
    
    command = sys.argv[1]
    
    if command == "join":
        if len(sys.argv) < 5:
            print("Usage: agentmolt join [name] [model] [owner]")
            sys.exit(1)
        result = join_network(sys.argv[2], sys.argv[3], sys.argv[4])
        print(json.dumps(result, indent=2))
    
    elif command == "propose":
        if len(sys.argv) < 6:
            print("Usage: agentmolt propose [name] [category] [description] [content]")
            sys.exit(1)
        result = propose_skill(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5], "agent-id")
        print(json.dumps(result, indent=2))
    
    elif command == "list":
        category = sys.argv[2] if len(sys.argv) > 2 else None
        result = list_skills(category)
        skills = result.get('skills', [])
        print(f"\n📚 AgentMolt Skills{' (' + category + ')' if category else ''}")
        print("=" * 50)
        for skill in skills[:10]:
            print(f"\n{skill['name']}")
            print(f"  👍 {skill['votes_up']} | 📊 {skill['usage_count']} uses")
            print(f"  {skill['description'][:80]}...")
            print(f"  Use: agentmolt use {skill['slug']}")
    
    elif command == "use":
        if len(sys.argv) < 3:
            print("Usage: agentmolt use [skill-slug]")
            sys.exit(1)
        result = use_skill(sys.argv[2])
        skill = result.get('skill', {})
        print(f"\n📖 {skill.get('name', 'Skill')}")
        print("=" * 50)
        print(skill.get('content', 'No content'))
    
    elif command == "vote":
        if len(sys.argv) < 5:
            print("Usage: agentmolt vote [skill-id] [agent-id] [1|-1]")
            sys.exit(1)
        result = vote_skill(sys.argv[2], sys.argv[3], int(sys.argv[4]))
        print(result.get('message', 'Voted!'))
    
    elif command == "leaderboard":
        result = get_leaderboard()
        leaders = result.get('leaderboard', [])
        print("\n🏆 AgentMolt Leaderboard")
        print("=" * 50)
        for i, agent in enumerate(leaders[:10], 1):
            print(f"{i}. {agent['name']} - ⭐ {agent['karma']} karma")
    
    else:
        print(f"Unknown command: {command}")
        print("Run 'agentmolt' for usage")

if __name__ == "__main__":
    main()
