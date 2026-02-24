# Zendesk MCP HTTP Server

A remote HTTP MCP server for Zendesk with built-in OAuth 2.0 authentication support via `/mcp auth` in Claude.

## Quick Start

### 1. Start the Server

```bash
cd ~/MCP/zemdesk-mcp-hhtp
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
- **OAuth 2.0**: Secure authentication via `/mcp auth` 
- **Auto Token Refresh**: Handles token expiration automatically

## Available Tools

- `list_tickets` - List recent Zendesk tickets
- `search_tickets` - Search for tickets by query
- `get_ticket_details` - Get full ticket details
- `search_knowledge_articles` - Search knowledge base
- `list_articles` - List recent articles
- `get_article_details` - Get article details

## Configuration

The server uses these defaults (can be overridden via environment variables):

- `ZENDESK_URL`: https://afsit1686145325.zendesk.com
- OAuth Client ID: `claude_oauth_client` (Public client - no secret needed)

## How It Works

1. Claude Desktop handles the OAuth flow with Zendesk using PKCE (for Public clients)
2. After authentication, Claude sends access tokens to this server
3. The server uses those tokens to make Zendesk API calls
4. All 6 tools become available in Claude conversations

