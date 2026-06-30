import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

async function main() {
  console.log("Initializing SSE Transport...");
  
  // The SSEClientTransport connects to the /sse endpoint. 
  // It will automatically discover the POST /message endpoint from the server's response.
  const transport = new SSEClientTransport(new URL("http://localhost:3001/sse"));
  
  const client = new Client({
    name: "test-agent",
    version: "1.0.0"
  }, {
    capabilities: {}
  });

  console.log("Connecting to Gateway at http://localhost:3001/sse ...");
  await client.connect(transport);
  console.log("✅ Connected successfully!");

  console.log("Fetching available tools from the Gateway...");
  const tools = await client.listTools();
  
  console.log("✅ Received tools:");
  tools.tools.forEach(t => console.log(` - ${t.name}`));

  console.log("\nTesting complete. Closing connection...");
  await client.close();
  process.exit(0);
}

main().catch(console.error);
