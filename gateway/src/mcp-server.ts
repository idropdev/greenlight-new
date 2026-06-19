import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { StateMachine } from "./state-machine";
import { store } from "./store";
import { DesignSchema } from "./schema";

const server = new Server(
  {
    name: "greenlight-gateway",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "create_session",
        description: "Create a new human-in-the-loop review session for a design",
        inputSchema: {
          type: "object",
          properties: {
            tenant: { type: "string" },
            agent_id: { type: "string" },
            intent: { type: "string" }
          },
          required: ["tenant", "agent_id"]
        }
      },
      {
        name: "post_design",
        description: "Post a completed design to an existing session for review",
        inputSchema: {
          type: "object",
          properties: {
            session_id: { type: "string" },
            design: { type: "object", description: "A2UI design object" }
          },
          required: ["session_id", "design"]
        }
      },
      {
        name: "get_state",
        description: "Get the current state of a review session",
        inputSchema: {
          type: "object",
          properties: {
            session_id: { type: "string" }
          },
          required: ["session_id"]
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "create_session") {
    const { tenant, agent_id, intent } = args as any;
    if (!tenant || !agent_id) {
      throw new Error("Missing required arguments: tenant, agent_id");
    }
    
    const session = StateMachine.createSession(tenant, agent_id, intent);
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          session_id: session.session_id,
          review_url: session.review_url,
          expires_at: session.expires_at
        }, null, 2)
      }]
    };
  }

  if (name === "post_design") {
    const { session_id, design } = args as any;
    
    try {
      // Validate design
      const validDesign = DesignSchema.parse(design);
      const result = StateMachine.postDesign(session_id, validDesign);
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify(result, null, 2)
        }]
      };
    } catch (e) {
      if (e instanceof z.ZodError) {
        throw new Error(`Invalid design schema: ${JSON.stringify(e.errors)}`);
      }
      throw e;
    }
  }

  if (name === "get_state") {
    const { session_id } = args as any;
    const session = store.getSession(session_id);
    
    if (!session) {
      throw new Error("Session not found");
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          state: session.state,
          design: session.design,
          result: session.result
        }, null, 2)
      }]
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Gateway MCP Server running on stdio");
}

runServer().catch(console.error);
