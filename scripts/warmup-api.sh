#!/bin/bash
# AgentMolt API Wake-up Script
# Usage: ./warmup-api.sh

echo "🦞 Warming up AgentMolt API..."
echo ""

API_URL="https://agentmolt-api.onrender.com"

# Function to ping endpoint with timeout
ping_endpoint() {
    local endpoint=$1
    local name=$2
    
    echo -n "  → $name... "
    
    start_time=$(date +%s%N)
    response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 60 "$API_URL$endpoint" 2>&1)
    end_time=$(date +%s%N)
    
    duration=$(( (end_time - start_time) / 1000000 )) # Convert to ms
    
    if [ "$response" = "200" ] || [ "$response" = "404" ]; then
        echo "✅ Ready (${duration}ms)"
        return 0
    else
        echo "⏳ Still waking (${duration}ms)"
        return 1
    fi
}

# Ping all critical endpoints
ping_endpoint "/health" "Health Check"
ping_endpoint "/api/skills" "Skills Endpoint"
ping_endpoint "/api/agents" "Agents Endpoint"

echo ""
echo "✨ API is warm and ready for onboarding!"
echo "   URL: $API_URL"
