# Testing Guide for Analytics Tools

## Setup

1. **Start the server:**
   ```bash
   cd zendesk-mcp-http
   npm install
   npm start
   ```

2. **Authenticate in Claude:**
   ```
   /mcp
   ```
   Select "Authenticate" for Zendesk

## Test Cases

### 1. count_tickets

**Test Case 1: Basic count**
```
Ask Claude: "How many open tickets do we have?"
Expected: Uses count_tickets with query "status:open"
```

**Test Case 2: Filtered count**
```
Ask Claude: "Count high-priority tickets created this week"
Expected: Uses count_tickets with complex query including priority and date filters
```

**Test Case 3: Advanced query**
```
Ask Claude: "How many incident tickets are assigned to agent email@example.com?"
Expected: Uses count_tickets with query "type:incident assignee:email@example.com"
```

---

### 2. get_ticket_metrics

**Test Case 1: Single ticket metrics**
```
Ask Claude: "Show me performance metrics for ticket #1"
Expected: Returns reply_time, resolution_time, reopens for ticket 1
```

**Test Case 2: Batch metrics**
```
Ask Claude: "Get metrics for the last 100 tickets to analyze response times"
Expected: Returns paginated metrics without ticket_id parameter
```

**Test Case 3: Analyze specific metric**
```
Ask Claude: "What's the average first response time for recent tickets?"
Expected: Fetches batch metrics, Claude calculates average from reply_time field
```

---

### 3. get_satisfaction_ratings

**Test Case 1: Filter by score**
```
Ask Claude: "Show me all bad satisfaction ratings"
Expected: Uses score="bad" parameter
```

**Test Case 2: Time-based filter**
```
Ask Claude: "Get CSAT ratings from the last 7 days"
Expected: Calculates start_time as 7 days ago, fetches ratings
```

**Test Case 3: Range filter**
```
Ask Claude: "Show me satisfaction ratings between March 1st and March 15th"
Expected: Uses both start_time and end_time parameters
```

**Test Case 4: Good ratings with comments**
```
Ask Claude: "What are customers saying in good CSAT ratings this month?"
Expected: Filters score="good" with current month time range
```

---

### 4. export_ticket_stats

**Test Case 1: Basic daily stats**
```
Ask Claude: "Give me ticket creation stats for the last 30 days"
Expected: Returns daily breakdown of ticket counts by date
```

**Test Case 2: Grouped by priority**
```
Ask Claude: "Export ticket statistics for March grouped by priority"
Expected: Returns stats with by_priority object showing counts per priority level
```

**Test Case 3: Grouped by type**
```
Ask Claude: "Show me ticket trends for the last two weeks by ticket type"
Expected: Returns daily stats plus by_type grouping
```

**Test Case 4: Edge case - 31 day limit**
```
Ask Claude: "Give me ticket stats for the last 60 days"
Expected: Should return error "Date range cannot exceed 31 days"
```

**Test Case 5: Status breakdown**
```
Ask Claude: "Show me how many tickets were created each day this week and their statuses"
Expected: Returns by_day with status counts (open, pending, solved, etc.)
```

---

## Manual API Testing (with curl)

If you want to test the endpoints directly:

### Prerequisites
```bash
# Get your access token after authenticating via /mcp in Claude
# Look for it in server logs or intercept from browser dev tools
export ACCESS_TOKEN="your_token_here"
export ZENDESK_URL="https://afsit1686145325.zendesk.com"
```

### count_tickets
```bash
curl -X POST http://localhost:3001/mcp \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "count_tickets",
      "arguments": {
        "query": "status:open"
      }
    },
    "id": 1
  }'
```

### get_ticket_metrics (single ticket)
```bash
curl -X POST http://localhost:3001/mcp \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "get_ticket_metrics",
      "arguments": {
        "ticket_id": 1
      }
    },
    "id": 2
  }'
```

### get_satisfaction_ratings (bad scores)
```bash
curl -X POST http://localhost:3001/mcp \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "get_satisfaction_ratings",
      "arguments": {
        "score": "bad"
      }
    },
    "id": 3
  }'
```

### export_ticket_stats (last 7 days)
```bash
curl -X POST http://localhost:3001/mcp \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "export_ticket_stats",
      "arguments": {
        "start_date": "2024-01-01",
        "end_date": "2024-01-07",
        "group_by": "priority"
      }
    },
    "id": 4
  }'
```

---

## Expected Response Format

### count_tickets
```json
{
  "query": "status:open",
  "count": 42
}
```

### get_ticket_metrics (single)
```json
{
  "ticket_id": 1,
  "reply_time_in_minutes": {
    "business": 120,
    "calendar": 150
  },
  "first_resolution_time_in_minutes": {
    "business": 480,
    "calendar": 600
  },
  "full_resolution_time_in_minutes": {
    "business": 960,
    "calendar": 1200
  },
  "reopens": 2,
  "replies": 5
}
```

### get_satisfaction_ratings
```json
[
  {
    "id": 123,
    "score": "bad",
    "comment": "Response was too slow",
    "ticket_id": 456,
    "created_at": "2024-01-15T10:30:00Z"
  }
]
```

### export_ticket_stats
```json
{
  "date_range": {
    "start": "2024-01-01",
    "end": "2024-01-07"
  },
  "total_tickets": 150,
  "by_day": {
    "2024-01-01": {
      "count": 20,
      "statuses": {
        "open": 15,
        "pending": 3,
        "solved": 2
      }
    },
    "2024-01-02": {
      "count": 25,
      "statuses": {
        "open": 18,
        "pending": 5,
        "solved": 2
      }
    }
  },
  "by_priority": {
    "high": 30,
    "normal": 90,
    "low": 20,
    "urgent": 10
  }
}
```

---

## Validation Checklist

- [ ] All 4 new tools appear in `/mcp` tools list
- [ ] count_tickets returns correct count format
- [ ] get_ticket_metrics works with and without ticket_id
- [ ] get_satisfaction_ratings filters work correctly
- [ ] export_ticket_stats enforces 31-day limit
- [ ] export_ticket_stats aggregation logic is correct
- [ ] All tools handle missing/optional parameters gracefully
- [ ] Error messages are clear and actionable
- [ ] No tokens are logged to console (only "Present"/"MISSING")
- [ ] Server doesn't crash on malformed queries

---

## Troubleshooting

### "Unauthorized" Error
- Ensure you've authenticated via `/mcp` in Claude
- Check that access token is being sent in Authorization header
- Verify token hasn't expired (re-authenticate if needed)

### "Date range cannot exceed 31 days"
- This is expected for export_ticket_stats with >31 day ranges
- Reduce the date range or split into multiple queries

### Empty Results
- Verify the Zendesk sandbox has test data
- Check query syntax for count_tickets (use Zendesk search syntax)
- Ensure date ranges include periods with ticket activity

### 429 Rate Limit Errors
- Wait for the retry-after period
- Reduce frequency of API calls
- Consider implementing the retry logic from REVIEW_SUMMARY.md

---

## Demo Script

Here's a complete demo flow to show all features:

```
1. "How many tickets do we have in total?"
   → Uses count_tickets

2. "Show me metrics for ticket #1"
   → Uses get_ticket_metrics with specific ID

3. "What are the bad satisfaction ratings from this week?"
   → Uses get_satisfaction_ratings with score filter

4. "Give me ticket creation stats for the last week grouped by priority"
   → Uses export_ticket_stats with grouping

5. "How many high-priority incidents were created yesterday?"
   → Uses count_tickets with complex query

6. "Get performance metrics for the last 50 tickets"
   → Uses get_ticket_metrics without ID for batch data
```
