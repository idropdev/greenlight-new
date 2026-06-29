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
        description: "Post a completed A2UI v0.1.2 design object to an existing session for review. The design must include: schema_version '0.1.2', canvas (with square|portrait|story|landscape preset), content (with flyer_type and fields), and layers.background. Field keys in fields are camelCase and vary by flyer_type: event (title, date, startTime, endTime, location, description), service (businessName, serviceOffered, tagline, contact, description), product (productName, price, tagline, callToAction, description), sale (headline, discount, promoCode, validUntil, description), realEstate (propertyTitle, price, address, features, contact), hiring (jobTitle, company, location, payRange, howToApply). Dates should be ISO-ish strings and times 24h 'HH:MM' if possible. background.value is a URL for type image or a hex for type color. Coordinates for overlay items are normalized (0 to 1), with (x, y) at the top-left corner.",
        inputSchema: {
          type: "object",
          properties: {
            session_id: {
              type: "string",
              description: "The ID of the active session to post the design to."
            },
            design: {
              type: "object",
              description: "The complete A2UI v0.1.2 design object conforming to the FieldsDesignSchema.",
              properties: {
                schema_version: {
                  type: "string",
                  enum: ["0.1.2"],
                  description: "Must be exactly '0.1.2'."
                },
                canvas: {
                  type: "object",
                  description: "Canvas configuration specifying preset and design dimensions.",
                  properties: {
                    preset: {
                      type: "string",
                      enum: ["square", "portrait", "story", "landscape", "custom"],
                      description: "Canvas preset. Typically one of: 'square', 'portrait', 'story', 'landscape'."
                    },
                    width: {
                      type: "number",
                      description: "Width in pixels (e.g. 1080)."
                    },
                    height: {
                      type: "number",
                      description: "Height in pixels (e.g. 1080)."
                    }
                  },
                  required: ["preset", "width", "height"]
                },
                content: {
                  type: "object",
                  description: "The dynamic content block of the flyer.",
                  properties: {
                    flyer_type: {
                      type: "string",
                      enum: ["event", "service", "product", "sale", "realEstate", "hiring"],
                      description: "The flyer type."
                    },
                    fields: {
                      type: "object",
                      description: "CamelCase key-value strings depending on flyer_type:\n- event: title, date, startTime, endTime, location, description\n- service: businessName, serviceOffered, tagline, contact, description\n- product: productName, price, tagline, callToAction, description\n- sale: headline, discount, promoCode, validUntil, description\n- realEstate: propertyTitle, price, address, features, contact\n- hiring: jobTitle, company, location, payRange, howToApply",
                      additionalProperties: {
                        type: "string"
                      }
                    }
                  },
                  required: ["flyer_type", "fields"]
                },
                layers: {
                  type: "object",
                  description: "Layers forming the flyer layout.",
                  properties: {
                    background: {
                      type: "object",
                      description: "The background layer.",
                      properties: {
                        type: {
                          type: "string",
                          enum: ["image", "color", "gradient"],
                          description: "Background type. image uses a URL value, color uses a hex string value."
                        },
                        value: {
                          type: "string",
                          description: "The background value: an image URL or hex color (e.g. '#0B6E4F')."
                        },
                        fit: {
                          type: "string",
                          description: "Image fit mode (typically 'cover')."
                        }
                      },
                      required: ["type", "value"]
                    },
                    overlay: {
                      type: "array",
                      description: "Optional array of overlay text or image items. Coordinates are normalized from 0 to 1.",
                      items: {
                        type: "object",
                        properties: {
                          id: {
                            type: "string",
                            description: "Stable element ID (e.g. 'el_1')."
                          },
                          type: {
                            type: "string",
                            enum: ["text", "image"],
                            description: "The overlay element type."
                          },
                          content: {
                            type: "string",
                            description: "The text content (required if type is 'text')."
                          },
                          value: {
                            type: "string",
                            description: "The image URL (required if type is 'image')."
                          },
                          x: {
                            type: "number",
                            minimum: 0,
                            maximum: 1,
                            description: "Normalized x-coordinate (top-left, 0 to 1)."
                          },
                          y: {
                            type: "number",
                            minimum: 0,
                            maximum: 1,
                            description: "Normalized y-coordinate (top-left, 0 to 1)."
                          },
                          w: {
                            type: "number",
                            minimum: 0,
                            maximum: 1,
                            description: "Normalized width (0 to 1)."
                          },
                          h: {
                            type: "number",
                            minimum: 0,
                            maximum: 1,
                            description: "Normalized height (0 to 1). Required for type 'image'."
                          },
                          font: {
                            type: "string",
                            description: "Font name (required for type 'text')."
                          },
                          size: {
                            type: "number",
                            description: "Font size in pixels of 1080-space (required for type 'text')."
                          },
                          color: {
                            type: "string",
                            description: "Hex color code (required for type 'text')."
                          },
                          align: {
                            type: "string",
                            enum: ["left", "center", "right"],
                            description: "Text alignment (required for type 'text')."
                          }
                        },
                        required: ["id", "type", "x", "y", "w"]
                      }
                    }
                  },
                  required: ["background"]
                },
                meta: {
                  type: "object",
                  description: "Metadata for tracking source, tenant, and intent.",
                  properties: {
                    source_agent: {
                      type: "string",
                      description: "Source agent identifier."
                    },
                    tenant: {
                      type: "string",
                      description: "Tenant identifier."
                    },
                    intent: {
                      type: "string",
                      description: "Session/design intent."
                    }
                  },
                  required: ["source_agent", "tenant"]
                }
              },
              required: ["schema_version", "canvas", "content", "layers", "meta"]
            }
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
