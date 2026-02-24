FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY http-server.js .

# Zendesk configuration from environment
ENV ZENDESK_URL=https://afsit1686145325.zendesk.com
ENV ZENDESK_OAUTH_CLIENT_ID=claude_oauth_client

# Expose HTTP port for MCP
EXPOSE 3001

# Start HTTP MCP server
CMD ["node", "http-server.js"]
