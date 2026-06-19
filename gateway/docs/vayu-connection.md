# Connecting the Vayu Agent to the Gateway

This document explains how the Model Context Protocol (MCP) connects the Vayu AI agent to your new Green Light Gateway.

## How it works (Stdio vs HTTP)

The Gateway consists of two different servers running simultaneously:
1. **The HTTP API (`npm run dev:api`)**: This runs on a local web port (e.g., `3000`). It is designed for **Carlos's React App** to communicate with over the network using `GET` and `POST` requests.
2. **The MCP Server (`npm run dev:mcp`)**: This is designed for the **Vayu Agent**. It does *not* run on a web port. Instead, it uses `StdioServerTransport`, which means it communicates entirely via Standard Input and Output (your terminal).

Because it uses `stdio`, Vayu does not send HTTP requests to a URL like `http://localhost...` to reach the MCP server. Instead, **Vayu itself spawns your MCP server as a background child process on your computer** and reads/writes JSON directly to its input and output streams.

## What you need from Vayu

To connect the two, you need to find **Vayu's MCP configuration settings**. Depending on how Vayu is built, this might be a `settings.json` file, an `mcp.json` file, or a settings dashboard in the agent's UI.

You must provide Vayu with three pieces of information so it knows exactly what terminal command to execute to start your server:

1. **Command**: The CLI executable to run (e.g., `npm`, `npx`, or `node`).
2. **Arguments**: The arguments passed to that command (e.g., `["run", "dev:mcp"]`).
3. **Working Directory (CWD)**: The absolute path on your machine where the command should be run.

### Example Configuration

If Vayu uses a standard JSON-based MCP configuration (similar to Claude Desktop or Cursor), you will need to add a block exactly like this:

```json
{
  "mcpServers": {
    "greenlight-gateway": {
      "command": "npm",
      "args": ["run", "dev:mcp"],
      "cwd": "/Users/isaacpadilla/DropDevProjects/GreenLight/greenlight-new/gateway"
    }
  }
}
```

*Note: If `npm` causes issues in Vayu due to environment paths, you can alternatively use `npx` with args `["tsx", "src/mcp-server.ts"]`.*

## Testing the Connection

Once Vayu's configuration is updated:
1. Restart the Vayu agent.
2. Open a chat or terminal with Vayu.
3. Prompt Vayu with natural language:
   > *"Create a Green Light session for the tenant 'vayu' and agent_id 'agent-007' with the intent 'event flyer'."*

If connected correctly, Vayu will recognize the `create_session` tool exposed by your gateway, execute it, and return the newly generated `review_url`. You can follow this up by asking Vayu to use the `post_design` tool to upload a design based on the `a2ui-contract.md` schema.

## Troubleshooting

- **Server fails to start:** Ensure the `cwd` path in the Vayu config is exactly correct and points to your new `/gateway` directory.
- **Can't find tools:** Check Vayu's logs to see if it successfully connected to the stdio stream. If the console outputs any `console.log` statements on boot (other than valid JSON-RPC), it can sometimes break the MCP `stdio` stream. (This is why MCP servers typically use `console.error` for standard logging, which `mcp-server.ts` handles).
