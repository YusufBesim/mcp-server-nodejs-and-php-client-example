import express from 'express';

const server = express();
server.use(express.json());

let counter = 0;

function getServer() {
    return {
        connect: async (transport) => {
            console.log('Server connected to transport');
        },
        close: () => {
            console.log('Server closed');
        }
    };
}

class StreamableHTTPServerTransport {
    constructor(options) {
        this.sessionIdGenerator = undefined;
        console.log('StreamableHTTPServerTransport instantiated');
    }

    async handleRequest(req, res, body) {
        console.log('Transport handling request (expecting JSON-RPC), received body:', JSON.stringify(body, null, 2));

        // Strict JSON-RPC 2.0 validation for all incoming requests
        if (!body || typeof body !== 'object' || body.jsonrpc !== '2.0' || !body.method || (body.id === undefined && body.jsonrpc !== '2.0')) {
            console.error('ERROR: Incoming request is not a valid JSON-RPC 2.0 Request:', body);
            // Return a JSON-RPC 2.0 Parse Error or Invalid Request error
            return res.status(200).json({
                jsonrpc: '2.0',
                error: {
                    code: -32600, // Invalid Request or Parse Error
                    message: 'Invalid JSON-RPC 2.0 Request: Check "jsonrpc", "method", and "id" fields.',
                },
                id: (typeof body === 'object' && body.id !== undefined) ? body.id : null, // Preserve ID if available
            });
        }

        const method = body.method;
        const params = body.params || {}; // Ensure params is an object, even if not sent
        const id = body.id !== undefined ? body.id : null; // Preserve original id

        console.log(`Received JSON-RPC 2.0 request - Method: "${method}", ID: "${id}", Params:`, JSON.stringify(params, null, 2));

        let jsonrpcResult; // The content for the 'result' field of the JSON-RPC response
        let jsonrpcError = null; // The content for the 'error' field of the JSON-RPC response

        // Prepare JSON-RPC request to MCP server
        try {
            switch (method) {
                case 'initialize':
                    console.log(`Executing method 'initialize'`);
                    jsonrpcResult = {
                        protocolVersion: "2025-03-26", // Use the version your client expects
                        capabilities: {
                            supportsToolsList: true,
                            supportsToolsCall: true,
                            // Other capabilities
                        },
                        serverInfo: {
                            name: "Your MCP Server",
                            version: "1.0.0",
                        },
                        message: "MCP server initialized successfully!"
                    };
                    break;

                case 'tools/list':
                    console.log(`Executing method 'tools/list'`);
                    return res.status(200).json({
                        jsonrpc: '2.0',
                        result: {
                            tools: [
                                {
                                    name: 'increment',
                                    description: 'Increments the counter by one.',
                                    inputSchema: { type: 'object', properties: {}, required: [] }
                                },
                                {
                                    name: 'status',
                                    description: 'Returns the current counter value.',
                                    inputSchema: { type: 'object', properties: {}, required: [] }
                                },
                                {
                                    name: 'reset',
                                    description: 'Resets the counter to zero.',
                                    inputSchema: { type: 'object', properties: {}, required: [] }
                                }
                            ]
                        },
                        id: id
                    });

                case 'tools/call':
                    console.log(`Executing method 'tools/call' with args:`, JSON.stringify(params, null, 2));

                    const toolName = params.name; // params object has 'name' and 'arguments' fields
                    const toolArguments = params.arguments || {};

                    if (!toolName) {
                        jsonrpcError = { code: -32602, message: "Invalid params: Tool name is required." };
                        break;
                    }

                    let toolOutputContentObject; // This will be the actual content of the tool result block
                    let toolIsError = false; // This indicates if the tool execution itself was an error

                    try {
                        console.log(`DEBUG: Attempting to execute tool: ${toolName}`);
                        switch (toolName) {
                            case 'increment':
                                counter++;
                                toolOutputContentObject = { value: counter, message: 'Counter incremented.' };
                                console.log(`DEBUG: Counter incremented. New value: ${counter}`);
                                break;
                            case 'status':
                                toolOutputContentObject = { value: counter, message: 'Current counter value.' };
                                console.log(`DEBUG: Current counter value requested: ${counter}`);
                                break;
                            case 'reset':
                                counter = 0;
                                toolOutputContentObject = { value: 0, message: 'Counter reset.' };
                                console.log(`DEBUG: Counter reset. New value: ${counter}`);
                                break;
                            default:
                                toolIsError = true;
                                toolOutputContentObject = { error: `Tool not found: ${toolName}` };
                                console.warn(`WARN: Attempted to call unknown tool: ${toolName}`);
                                break;
                        }
                        console.log(`DEBUG: Tool execution successful for ${toolName}. Raw output:`, toolOutputContentObject);
                    } catch (e) {
                        toolIsError = true;
                        toolOutputContentObject = { error: `Error executing tool '${toolName}': ${e.message}` };
                        console.error(`ERROR: Exception caught during tool execution for '${toolName}':`, e);
                    }

                    // Parse and handle MCP server response
                    // **Crucial: The 'content' field must now be an ARRAY of content blocks**
                    jsonrpcResult = { // This is the object that will go into the 'result' field of the JSON-RPC response
                        tool_call_id: id, // The original JSON-RPC ID becomes the tool_call_id
                        role: "tool",
                        name: toolName,
                        // --- CHANGED PART: content is now an array of objects ---
                        // Ensure the response contains the expected content block
                        content: [{
                            type: "text", // <-- Type of content block
                            text: JSON.stringify(toolOutputContentObject) // <-- Text content is the stringified JSON output
                        }],
                        // --- /CHANGED PART ---
                        is_error: toolIsError
                    };
                    break;

                case 'echo':
                    console.log(`Executing method 'echo' with params:`, params);
                    jsonrpcResult = params;
                    break;

                case 'getCurrentTime':
                    console.log(`Executing method 'getCurrentTime'`);
                    jsonrpcResult = new Date().toISOString();
                    break;

                default:
                    // Handle invalid or unexpected response format
                    jsonrpcError = { code: -32601, message: `Method not found: ${method}` };
                    console.warn(`WARN: Method not found: ${method}`);
                    break;
            }
        } catch (e) {
            jsonrpcError = { code: -32000, message: `Internal server error during method execution: ${e.message}` };
            console.error(`ERROR: Unhandled exception during method execution:`, e);
        }

        // Send the final JSON-RPC 2.0 response
        if (jsonrpcError) {
            console.log(`DEBUG: Sending JSON-RPC error response:`, JSON.stringify(jsonrpcError));
            return res.status(200).json({
                jsonrpc: '2.0',
                error: jsonrpcError,
                id: id,
            });
        } else {
            console.log(`DEBUG: Sending JSON-RPC successful response:`, JSON.stringify(jsonrpcResult));
            return res.status(200).json({
                jsonrpc: '2.0',
                result: jsonrpcResult,
                id: id,
            });
        }
    }

    close() {
        console.log('Transport closed');
    }
}

server.post('/mcp', async (req, res) => {
    try {
        const server = getServer();
        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
        });

        await transport.handleRequest(req, res, req.body);

        res.on('close', () => {
            console.log('Request closed');
            transport.close();
            server.close();
        });

    } catch (error) {
        console.error('Error handling MCP request in main Express route (outside handleRequest):', error);
        if (!res.headersSent) {
            res.status(500).json({
                jsonrpc: '2.0', // Fallback to a standard JSON-RPC error if Express route itself fails
                error: { code: -32603, message: `Internal server error: ${error.message}` },
                id: null
            });
        }
    }
});

server.get('/mcp', async (req, res) => {
    console.log('Received GET MCP request');
    res.writeHead(405).end(JSON.stringify({
        jsonrpc: "2.0",
        error: {
            code: -32000,
            message: "Method not allowed."
        },
        id: null
    }));
});

server.delete('/mcp', async (req, res) => {
    console.log('Received DELETE MCP request');
    res.writeHead(405).end(JSON.stringify({
        jsonrpc: "2.0",
        error: {
            code: -32000,
            message: "Method not allowed."
        },
        id: null
    }));
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`MCP Stateless Streamable HTTP Server listening on port ${PORT}`);
});