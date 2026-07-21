# Zendesk MCP HTTP Server

A remote HTTP MCP server for Zendesk with built-in OAuth 2.0 authentication support via `/mcp auth` in Claude.

## Quick Start

### 1. Start the Server

```bash
cd ~/Zendesk-MCP-Server/zendesk-mcp-http
npm install
npm start
```

The server will run on http://localhost:3001

### 2. Add to Claude Desktop/Code

```bash
claude mcp add --transport http --client-id claude_oauth_client zendesk http://localhost:3001/mcp
```

No client secret needed - Zendesk Public OAuth clients don't require it!

### 3. Authenticate in Claude

In Claude Desktop or Claude Code, type:

```
/mcp
```

Select "Authenticate" for Zendesk, and your browser will open to complete the OAuth flow.

## Features

- **Ticket Management**: List, search, and get ticket details
- **Knowledge Base**: Search and retrieve articles
- **Analytics & Metrics**: Ticket counts, performance metrics, CSAT ratings, and statistical exports
- **OAuth 2.0**: Secure authentication via `/mcp auth` 
- **Auto Token Refresh**: Handles token expiration automatically

## Available Tools

### Ticket Management
- `list_tickets` - List recent Zendesk tickets
- `search_tickets` - Search for tickets by query
- `get_ticket_details` - Get full ticket details

### Knowledge Base
- `search_knowledge_articles` - Search knowledge base
- `list_articles` - List recent articles
- `get_article_details` - Get article details

### Analytics & Reporting
- `count_tickets` - Count tickets matching a search query (fast count without fetching full data)
- `get_ticket_metrics` - Get performance metrics (reply time, resolution time, reopens) for tickets
- `get_satisfaction_ratings` - Retrieve customer satisfaction (CSAT) ratings with optional filters
- `export_ticket_stats` - Export aggregated ticket statistics by day with optional grouping (max 31 days)

## Example Questions for Analytics Tools

### count_tickets
Ask Claude natural-language questions like:
- "How many high-priority tickets are currently open?"
- "Count all tickets created in the last week that are still pending"
- "How many incident tickets were assigned to me this month?"

### get_ticket_metrics
Ask Claude questions like:
- "Show me the performance metrics for ticket #12345"
- "What are the reply times and resolution times for recent tickets?"
- "Get metrics for the last 100 tickets to analyze response performance"

### get_satisfaction_ratings
Ask Claude questions like:
- "Show me all the bad satisfaction ratings from this week"
- "What are customers saying in good CSAT ratings from the last month?"
- "Retrieve satisfaction ratings between January 1st and January 31st"

### export_ticket_stats
Ask Claude questions like:
- "Give me daily ticket creation stats for the last 30 days"
- "Export ticket statistics for March grouped by priority"
- "Show me ticket trends for the last two weeks broken down by ticket type"

## Configuration

The server uses these defaults (can be overridden via environment variables):

- `ZENDESK_URL`: https://afsit1686145325.zendesk.com
- OAuth Client ID: `claude_oauth_client` (Public client - no secret needed)

## How It Works

1. Claude Desktop handles the OAuth flow with Zendesk using PKCE (for Public clients)
2. After authentication, Claude sends access tokens to this server
3. The server uses those tokens to make Zendesk API calls
4. All 6 tools become available in Claude conversations

