const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");

const server = new McpServer({
    name: "mirai-assurance-mcp",
    version: "1.0.0"
});

server.tool(
    "get_hospitals",
    "Get all active hospitals from Mirai Assurance",
    {},
    async () => {
        const response = await fetch(
            "http://localhost:1234/api/hospitals"
        );

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }

        const hospitals = await response.json();

        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(hospitals, null, 2)
                }
            ]
        };
    }
);

server.tool(
    "get_all_insurance_plans",
    "Get all insurance plans from Mirai Assurance using the admin API",
    {},
    async () => {
        const token = process.env.MIRAI_ADMIN_TOKEN;

        if (!token) {
            throw new Error("MIRAI_ADMIN_TOKEN is not configured");
        }

        const response = await fetch(
            "http://localhost:1234/api/plans/admin/all",
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }

        const plans = await response.json();

        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(plans, null, 2)
                }
            ]
        };
    }
);


async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

main().catch(console.error);