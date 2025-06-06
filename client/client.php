<?php

use OpenAI\Client; // Use OpenAI PHP Client library
use stdClass;     // Include stdClass for object use

class AI {
    private $test = true;
    private $openaiClient;

    public function __construct() {
        parent::__construct();
        $this->openaiClient = OpenAI::client("your-openai-api-key"); // <!--- Dont forgot to change
    }

    public function mcp(){
        $userQuery = $_POST['query'] ?? 'Increase the number by one.';

        $mcpServerUrl = 'http://localhost:3000/mcp'; // Endpoint of your MCP server or any other MCP Server

        // Fetch tool definitions from MCP server
        $response = file_get_contents($mcpServerUrl, false, stream_context_create([
            'http' => [
                'method'  => 'POST',
                'header'  => "Content-Type: application/json\r\n",
                'content' => json_encode([
                    'jsonrpc' => '2.0',
                    'method' => 'tools/list',
                    'id' => 'php-client'
                ]),
            ]
        ]));

        $data = json_decode($response, true);
        $mcpTools = $data['result']['tools'] ?? [];

        $toolsForOpenAI = array_map(function ($tool) {
            return [
                'type' => 'function',
                'function' => [
                    'name' => $tool['name'],
                    'description' => $tool['description'],
                    'parameters' => [
                        'type' => 'object',
                        'properties' => new stdClass(),
                        'required' => [],
                    ],
                ],
            ];
        }, $mcpTools);

        $response = $this->openaiClient->chat()->create([
            'model' => 'gpt-3.5-turbo',
            'messages' => [
                ['role' => 'user', 'content' => $userQuery],
            ],
            'tools' => $toolsForOpenAI,
            'tool_choice' => 'auto',
        ]);

        $aiResponse = '';

        if (!empty($response->choices[0]->message->toolCalls)) {
            $toolCalls = $response->choices[0]->message->toolCalls;
            $messages = [
                ['role' => 'user', 'content' => $userQuery],
                $response->choices[0]->message->toArray(),
            ];

            foreach ($toolCalls as $toolCall) {
                $functionName = $toolCall->function->name;
                $functionArgs = (array) json_decode($toolCall->function->arguments, true);

                if ($this->test) {
                    error_log("AI wants to call tool: " . $functionName);
                    error_log("Tool arguments: " . print_r($functionArgs, true));
                }

                $toolOutput = null;
                $mcpToolName = '';
                $mcpToolInput = new stdClass();

                // Prepare the JSON-RPC request payload to call MCP tool
                $jsonRpcRequest = [
                    'jsonrpc' => '2.0',
                    'method' => 'tools/call',
                    'params' => [
                        'name' => $functionName,
                        'arguments' => $mcpToolInput
                    ],
                    'id' => uniqid(),
                ];

                // Log the JSON-RPC request and response for debugging
                error_log('MCP JSON-RPC Request: ' . json_encode($jsonRpcRequest));

                // Send request to MCP server and capture the response
                $ch = curl_init($mcpServerUrl);
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_POST, true);
                curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
                curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($jsonRpcRequest));

                $mcpResponse = curl_exec($ch);
                $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                // Log the JSON-RPC request and response for debugging
                error_log('MCP JSON-RPC Response: ' . $mcpResponse);
                curl_close($ch);

                if ($mcpResponse === false || $httpCode !== 200) {
                    // Handle error if MCP response is missing or not properly formatted
                    $toolOutput = "Error calling MCP server: " . ($mcpResponse === false ? curl_error($ch) : "HTTP Code: " . $httpCode . ", Response: " . $mcpResponse);
                } else {
                    // Ensure response includes the expected content block with tool output
                    $mcpResponseData = json_decode($mcpResponse, true);
                    if (isset($mcpResponseData['result']['content'][0]['text'])) {
                        $toolOutput = $mcpResponseData['result']['content'][0]['text'];
                    } else {
                        // Handle error if MCP response is missing or not properly formatted
                        $toolOutput = "Error: Invalid JSON-RPC response format from MCP server: " . $mcpResponse;
                    }
                }

                if ($this->test) {
                    error_log("MCP Server Response / Tool Output: " . $toolOutput);
                }

                $messages[] = [
                    'tool_call_id' => $toolCall->id,
                    'role' => 'tool',
                    'name' => $functionName,
                    'content' => $toolOutput,
                ];
            }

            $secondResponse = $this->openaiClient->chat()->create([
                'model' => 'gpt-3.5-turbo',
                'messages' => $messages,
                'tools' => $tools,
            ]);

            $secondChoice = $secondResponse->choices[0];

            if (!empty($secondChoice->message->content)) {
                $aiResponse = $secondChoice->message->content;
            }
            elseif (!empty($secondChoice->message->toolCalls)) {
                $aiResponse = "I attempted to perform your request, but the AI suggested another tool call after the first, which is not currently handled in this turn. Please try rephrasing.";
            }
            else {
                $aiResponse = "I'm sorry, I couldn't produce a response to your request.";
            }

        } else {
            $aiResponse = $response->choices[0]->message->content;
        }

        echo $aiResponse;
    }
}
