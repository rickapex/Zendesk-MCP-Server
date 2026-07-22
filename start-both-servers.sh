#!/bin/bash

# Start both Zendesk MCP servers
# TechOps environment on port 3001
# ACS Customer environment on port 3002

echo "🚀 Starting Zendesk MCP Servers..."
echo ""

# Start TechOps server
cd zendesk-mcp-http
echo "Starting TechOps server (https://afs-it.zendesk.com) on port 3001..."
npm start > /tmp/zendesk-mcp-techops.log 2>&1 &
TECHOPS_PID=$!
echo "  ✓ TechOps server started (PID: $TECHOPS_PID)"
cd ..

# Start ACS server
cd zendesk-mcp-acs
echo "Starting ACS server (https://apexclearing.zendesk.com) on port 3002..."
npm start > /tmp/zendesk-mcp-acs.log 2>&1 &
ACS_PID=$!
echo "  ✓ ACS server started (PID: $ACS_PID)"
cd ..

echo ""
echo "✅ Both servers are running!"
echo ""
echo "TechOps (afs-it.zendesk.com):     http://localhost:3001"
echo "ACS Customer (apexclearing):      http://localhost:3002"
echo ""
echo "To add to Claude Code:"
echo "  claude mcp add --transport http --client-id claude_oauth_client zendesk-techops http://localhost:3001/mcp"
echo "  claude mcp add --transport http --client-id claude_oauth_client zendesk-acs http://localhost:3002/mcp"
echo ""
echo "View logs:"
echo "  tail -f /tmp/zendesk-mcp-techops.log"
echo "  tail -f /tmp/zendesk-mcp-acs.log"
echo ""
echo "To stop servers:"
echo "  kill $TECHOPS_PID $ACS_PID"
echo ""
