#!/usr/bin/env node

/**
 * Zendesk MCP HTTP Server with OAuth 2.0 Support
 * This server can be added to Claude Code/Desktop using:
 * claude mcp add --transport http --client-id claude_oauth_client --client-secret zendesk http://localhost:3001/mcp
 * 
 * Then authenticate using: /mcp
 */

import express from 'express';
import axios from 'axios';

const app = express();
const PORT = 3001;

// Zendesk configuration
const ZENDESK_URL = process.env.ZENDESK_URL || 'https://afsit1686145325.zendesk.com';

// Parse both JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log all incoming requests
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.path}`);
  if (req.method === 'POST') {
    console.log('  Body:', JSON.stringify(req.body).substring(0, 100));
    console.log('  Auth:', req.headers.authorization ? req.headers.authorization.substring(0, 40) + '...' : 'NONE');
  }
  next();
});

// OAuth well-known endpoints (required for OAuth discovery)
app.get('/.well-known/oauth-authorization-server', (req, res) => {
  res.json({
    issuer: `http://localhost:${PORT}`,
    authorization_endpoint: `http://localhost:${PORT}/authorize`,
    token_endpoint: `http://localhost:${PORT}/token`,
    response_types_supported: ['code'],
    response_modes_supported: ['query'],
    grant_types_supported: ['authorization_code'],
    token_endpoint_auth_methods_supported: ['none'],
    code_challenge_methods_supported: ['S256'],
    scopes_supported: ['read', 'write']
  });
});

app.get('/.well-known/oauth-protected-resource', (req, res) => {
  res.json({
    resource_documentation: `http://localhost:${PORT}/mcp`
  });
});

// Store pending OAuth requests to handle callback
const pendingOAuthRequests = new Map();

// OAuth authorization endpoint - redirects to Zendesk
// Support both /authorize and /oauth/authorize paths
app.get(['/authorize', '/oauth/authorize'], (req, res) => {
  const { client_id, redirect_uri, state, code_challenge, code_challenge_method } = req.query;
  
  console.log('🔐 OAuth Authorization Request:');
  console.log('  Client ID:', client_id);
  console.log('  Redirect URI:', redirect_uri);
  console.log('  State:', state);
  
  // Store the original redirect_uri and state to use after Zendesk redirects back
  pendingOAuthRequests.set(state, { redirect_uri, code_challenge, code_challenge_method });
  
  // Use our server's callback URL instead of Claude's dynamic port
  const ourRedirectUri = `http://localhost:${PORT}/callback`;
  
  // Build Zendesk OAuth URL
  const authUrl = `${ZENDESK_URL}/oauth/authorizations/new?` +
    `response_type=code&` +
    `client_id=${client_id}&` +
    `redirect_uri=${encodeURIComponent(ourRedirectUri)}&` +
    `state=${state}&` +
    `scope=read%20write` +
    (code_challenge ? `&code_challenge=${code_challenge}&code_challenge_method=${code_challenge_method}` : '');
  
  console.log('  Redirecting to Zendesk with callback:', ourRedirectUri);
  res.redirect(authUrl);
});

// OAuth callback endpoint - receives code from Zendesk and forwards to Claude
app.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  
  console.log('🔄 OAuth Callback received:');
  console.log('  Code:', code);
  console.log('  State:', state);
  
  const originalRequest = pendingOAuthRequests.get(state);
  if (!originalRequest) {
    return res.status(400).send('Invalid state parameter');
  }
  
  // Redirect back to Claude with the authorization code
  const redirectUrl = `${originalRequest.redirect_uri}?code=${code}&state=${state}`;
  console.log('  Redirecting to Claude:', redirectUrl);
  
  pendingOAuthRequests.delete(state);
  res.redirect(redirectUrl);
});

// OAuth token endpoint - exchanges code for tokens
// Support both /token and /oauth/token paths
app.post(['/token', '/oauth/token'], async (req, res) => {
  // Try to parse as both form and JSON
  let params = {};
  
  // First try form-encoded body
  if (typeof req.body === 'string') {
    const parts = req.body.split('&');
    parts.forEach(part => {
      const [key, value] = part.split('=');
      params[decodeURIComponent(key)] = decodeURIComponent(value || '');
    });
  } else if (req.body && typeof req.body === 'object') {
    // Already parsed (from form or json middleware)
    params = req.body;
  }
  
  const { grant_type, code, redirect_uri, client_id, code_verifier } = params;
  
  console.log('💱 Token Exchange Request:');
  console.log('  Raw Body:', req.body);
  console.log('  Parsed Params:', params);
  console.log('  Grant Type:', grant_type);
  console.log('  Code:', code);
  console.log('  Redirect URI from Claude:', redirect_uri);
  console.log('  Client ID:', client_id);
  
  try {
    // Use our server's redirect URI instead of Claude's dynamic port
    const ourRedirectUri = `http://localhost:${PORT}/callback`;
    
    const tokenParams = new URLSearchParams();
    tokenParams.append('grant_type', grant_type);
    tokenParams.append('code', code);
    tokenParams.append('client_id', client_id);
    tokenParams.append('redirect_uri', ourRedirectUri); // Use our redirect URI, not Claude's
    
    if (code_verifier) {
      tokenParams.append('code_verifier', code_verifier);
    }
    
    const response = await axios.post(`${ZENDESK_URL}/oauth/tokens`, tokenParams.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    
    console.log('✅ Token Exchange Successful!');
    console.log('  Access Token:', response.data.access_token?.substring(0, 20) + '...');
    
    res.json({
      access_token: response.data.access_token,
      token_type: 'bearer',
      expires_in: response.data.expires_in,
      refresh_token: response.data.refresh_token,
      scope: response.data.scope
    });
  } catch (error) {
    console.error('❌ Token exchange error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.error || 'server_error',
      error_description: error.response?.data?.error_description || error.message
    });
  }
});

// MCP endpoint - implements JSON-RPC 2.0 over HTTP
app.post('/mcp', express.json(), async (req, res) => {
  const authHeader = req.headers.authorization;
  const accessToken = authHeader?.replace('Bearer ', '');
  
  console.log('🔧 MCP Request:');
  console.log('  Method:', req.body.method);
  console.log('  Auth Header:', authHeader ? authHeader.substring(0, 30) + '...' : 'MISSING');
  console.log('  Access Token:', accessToken ? accessToken.substring(0, 20) + '...' : 'MISSING');
  
  if (!accessToken) {
    console.log('❌ No access token provided');
    return res.status(401).json({
      jsonrpc: '2.0',
      error: { code: -32001, message: 'Unauthorized' },
      id: req.body.id
    });
  }
  
  // Create Zendesk API client
  const zendeskAPI = axios.create({
    baseURL: `${ZENDESK_URL}/api/v2`,
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  
  const { method, params, id } = req.body;
  
  console.log('🔍 Processing method:', method);
  
  try {
    // Handle initialize method
    if (method === 'initialize') {
      console.log('🚀 initialize request - sending capabilities');
      return res.json({
        jsonrpc: '2.0',
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: 'zendesk-mcp-server',
            version: '1.0.0'
          }
        },
        id
      });
    }
    
    // Handle MCP protocol methods
    if (method === 'tools/list') {
      console.log('📋 tools/list requested');
      return res.json({
        jsonrpc: '2.0',
        result: {
          tools: [
            {
              name: 'list_tickets',
              description: 'List recent Zendesk tickets',
              inputSchema: {
                type: 'object',
                properties: {
                  limit: { type: 'number', description: 'Number of tickets to fetch' },
                  status: { type: 'string', description: 'Filter by status (open, pending, solved)' }
                }
              }
            },
            {
              name: 'search_tickets',
              description: 'Search for tickets',
              inputSchema: {
                type: 'object',
                properties: {
                  query: { type: 'string', description: 'Search query' }
                },
                required: ['query']
              }
            },
            {
              name: 'get_ticket_details',
              description: 'Get full details of a specific ticket',
              inputSchema: {
                type: 'object',
                properties: {
                  ticket_id: { type: 'number', description: 'Zendesk ticket ID' }
                },
                required: ['ticket_id']
              }
            },
            {
              name: 'search_knowledge_articles',
              description: 'Search for knowledge base articles',
              inputSchema: {
                type: 'object',
                properties: {
                  query: { type: 'string', description: 'Search query for articles' },
                  limit: { type: 'number', description: 'Number of articles to fetch' }
                },
                required: ['query']
              }
            },
            {
              name: 'list_articles',
              description: 'List recent knowledge base articles',
              inputSchema: {
                type: 'object',
                properties: {
                  limit: { type: 'number', description: 'Number of articles to fetch' }
                }
              }
            },
            {
              name: 'get_article_details',
              description: 'Get full details of a knowledge base article',
              inputSchema: {
                type: 'object',
                properties: {
                  article_id: { type: 'number', description: 'Article ID' }
                },
                required: ['article_id']
              }
            },
            {
              name: 'count_tickets',
              description: 'Count tickets matching a search query. Returns total count without fetching full ticket data. Use Zendesk search syntax (e.g., "status:open priority:high", "created>2024-01-01", "type:incident assignee:me").',
              inputSchema: {
                type: 'object',
                properties: {
                  query: { type: 'string', description: 'Zendesk search query string' }
                },
                required: ['query']
              }
            },
            {
              name: 'get_ticket_metrics',
              description: 'Get performance metrics for tickets including reply time, resolution time, and reopen count. Retrieve metrics for a specific ticket by ID, or get paginated metrics for all tickets (up to 100 per request).',
              inputSchema: {
                type: 'object',
                properties: {
                  ticket_id: { type: 'number', description: 'Optional: specific ticket ID to get metrics for. Omit to get paginated metrics for all tickets.' }
                }
              }
            },
            {
              name: 'get_satisfaction_ratings',
              description: 'Get customer satisfaction ratings (CSAT scores). Filter by score (good/bad), time range, or retrieve all ratings. Returns rating details including score, comment, ticket ID, and timestamp.',
              inputSchema: {
                type: 'object',
                properties: {
                  score: { type: 'string', description: 'Filter by score: "good" or "bad"', enum: ['good', 'bad'] },
                  start_time: { type: 'string', description: 'Filter ratings created after this timestamp (Unix epoch or ISO 8601)' },
                  end_time: { type: 'string', description: 'Filter ratings created before this timestamp (Unix epoch or ISO 8601)' }
                }
              }
            },
            {
              name: 'export_ticket_stats',
              description: 'Export aggregated ticket statistics for a date range (max 31 days). Groups tickets by day and optionally by group/tags/priority/type. Returns counts and trends, not individual tickets. Useful for reporting and trend analysis.',
              inputSchema: {
                type: 'object',
                properties: {
                  start_date: { type: 'string', description: 'Start date in YYYY-MM-DD format or Unix timestamp' },
                  end_date: { type: 'string', description: 'End date in YYYY-MM-DD format or Unix timestamp' },
                  group_by: { type: 'string', description: 'Optional field to group stats by: group, tags, priority, or type', enum: ['group', 'tags', 'priority', 'type'] }
                },
                required: ['start_date', 'end_date']
              }
            }
          ]
        },
        id
      });
    }
    
    // Handle tool calls
    if (method === 'tools/call') {
      const { name, arguments: args } = params;
      
      console.log('🔨 Tool Call Request received:');
      console.log('  Tool Name:', name);
      console.log('  Arguments:', args);
      console.log('  Using Token:', accessToken.substring(0, 20) + '...');
      
      let result;
      
      if (name === 'list_tickets') {
        const response = await zendeskAPI.get('/tickets.json', {
          params: { limit: args.limit || 10, status: args.status || 'open' }
        });
        console.log('✅ list_tickets succeeded');
        result = { content: [{ type: 'text', text: JSON.stringify(response.data.tickets, null, 2) }] };
      } else if (name === 'search_tickets') {
        const response = await zendeskAPI.get('/search.json', {
          params: { query: args.query }
        });
        console.log('✅ search_tickets succeeded');
        result = { content: [{ type: 'text', text: JSON.stringify(response.data.results, null, 2) }] };
      } else if (name === 'get_ticket_details') {
        const response = await zendeskAPI.get(`/tickets/${args.ticket_id}.json`);
        console.log('✅ get_ticket_details succeeded');
        result = { content: [{ type: 'text', text: JSON.stringify(response.data.ticket, null, 2) }] };
      } else if (name === 'search_knowledge_articles') {
        const response = await zendeskAPI.get('/help_center/articles/search.json', {
          params: { query: args.query, per_page: args.limit || 10 }
        });
        console.log('✅ search_knowledge_articles succeeded');
        result = { content: [{ type: 'text', text: JSON.stringify(response.data.results, null, 2) }] };
      } else if (name === 'list_articles') {
        const response = await zendeskAPI.get('/help_center/articles.json', {
          params: { per_page: args.limit || 10 }
        });
        console.log('✅ list_articles succeeded');
        result = { content: [{ type: 'text', text: JSON.stringify(response.data.articles, null, 2) }] };
      } else if (name === 'get_article_details') {
        const response = await zendeskAPI.get(`/help_center/articles/${args.article_id}.json`);
        console.log('✅ get_article_details succeeded');
        result = { content: [{ type: 'text', text: JSON.stringify(response.data.article, null, 2) }] };
      } else if (name === 'count_tickets') {
        const response = await zendeskAPI.get('/search/count.json', {
          params: { query: args.query }
        });
        console.log('✅ count_tickets succeeded');
        result = {
          content: [{
            type: 'text',
            text: JSON.stringify({
              query: args.query,
              count: response.data.count
            }, null, 2)
          }]
        };
      } else if (name === 'get_ticket_metrics') {
        let response;
        if (args.ticket_id) {
          // Get metrics for a specific ticket
          response = await zendeskAPI.get(`/tickets/${args.ticket_id}/metrics.json`);
          console.log('✅ get_ticket_metrics (single) succeeded');
          result = { content: [{ type: 'text', text: JSON.stringify(response.data.ticket_metric, null, 2) }] };
        } else {
          // Get paginated metrics for all tickets (limit to 100)
          response = await zendeskAPI.get('/ticket_metrics.json', {
            params: { per_page: 100 }
          });
          console.log('✅ get_ticket_metrics (paginated) succeeded');
          result = { content: [{ type: 'text', text: JSON.stringify(response.data.ticket_metrics, null, 2) }] };
        }
      } else if (name === 'get_satisfaction_ratings') {
        const params = { per_page: 100 };
        if (args.score) params.score = args.score;
        if (args.start_time) params.start_time = args.start_time;
        if (args.end_time) params.end_time = args.end_time;

        const response = await zendeskAPI.get('/satisfaction_ratings.json', { params });
        console.log('✅ get_satisfaction_ratings succeeded');
        result = { content: [{ type: 'text', text: JSON.stringify(response.data.satisfaction_ratings, null, 2) }] };
      } else if (name === 'export_ticket_stats') {
        // Parse dates and validate range
        const startDate = new Date(args.start_date);
        const endDate = new Date(args.end_date);
        const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

        if (daysDiff > 31) {
          throw new Error('Date range cannot exceed 31 days');
        }

        // Convert to Unix timestamps
        const startTime = Math.floor(startDate.getTime() / 1000);

        // Fetch tickets using incremental export API
        const tickets = [];
        let nextPage = `/incremental/tickets.json?start_time=${startTime}`;

        while (nextPage && tickets.length < 10000) { // Safety cap
          const response = await zendeskAPI.get(nextPage);
          const fetchedTickets = response.data.tickets.filter(t => {
            const createdAt = new Date(t.created_at);
            return createdAt >= startDate && createdAt <= endDate;
          });
          tickets.push(...fetchedTickets);

          // Check if we've passed the end date
          const lastTicket = response.data.tickets[response.data.tickets.length - 1];
          if (lastTicket && new Date(lastTicket.created_at) > endDate) {
            break;
          }

          nextPage = response.data.next_page;
        }

        // Aggregate statistics
        const statsByDay = {};
        const statsByGroup = args.group_by ? {} : null;

        tickets.forEach(ticket => {
          const day = ticket.created_at.split('T')[0]; // YYYY-MM-DD

          // Count by day
          if (!statsByDay[day]) {
            statsByDay[day] = { count: 0, statuses: {} };
          }
          statsByDay[day].count++;
          const status = ticket.status || 'unknown';
          statsByDay[day].statuses[status] = (statsByDay[day].statuses[status] || 0) + 1;

          // Count by group_by field
          if (args.group_by && statsByGroup) {
            let groupKey;
            if (args.group_by === 'group') {
              groupKey = ticket.group_id || 'unassigned';
            } else if (args.group_by === 'tags') {
              groupKey = ticket.tags?.join(',') || 'no_tags';
            } else if (args.group_by === 'priority') {
              groupKey = ticket.priority || 'none';
            } else if (args.group_by === 'type') {
              groupKey = ticket.type || 'unknown';
            }

            if (groupKey) {
              statsByGroup[groupKey] = (statsByGroup[groupKey] || 0) + 1;
            }
          }
        });

        const summary = {
          date_range: { start: args.start_date, end: args.end_date },
          total_tickets: tickets.length,
          by_day: statsByDay
        };

        if (statsByGroup) {
          summary[`by_${args.group_by}`] = statsByGroup;
        }

        console.log('✅ export_ticket_stats succeeded');
        result = { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] };
      } else {
        throw new Error(`Unknown tool: ${name}`);
      }
      
      return res.json({
        jsonrpc: '2.0',
        result,
        id
      });
    }
    
    // Unknown method
    return res.json({
      jsonrpc: '2.0',
      error: { code: -32601, message: 'Method not found' },
      id
    });
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    return res.json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: error.response?.data?.error_description || error.message
      },
      id
    });
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀 Zendesk MCP HTTP Server running on http://localhost:${PORT}`);
  console.log(`\n📋 To add to Claude Code/Desktop:`);
  console.log(`   claude mcp add --transport http --client-id claude_oauth_client zendesk http://localhost:${PORT}/mcp\n`);
  console.log(`Then authenticate using: /mcp\n`);
});
