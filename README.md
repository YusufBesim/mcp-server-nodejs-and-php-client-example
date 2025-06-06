# MCP Server and Usage on PHP with OpenAI

This project demonstrates how to build a minimal [MCP (Model Customization Protocol)](https://platform.openai.com/docs/guides/function-calling) server using **Node.js** and how to interact with it via a **PHP client** using [openai-php/client](https://github.com/openai-php/client). The PHP client fetches available tools from the MCP server dynamically and uses them in a function calling context with OpenAI's API.


## 📁 Folder Structure

```
mcp-server-and-usage-on-php-with-openai/
├── server/
│   ├── server.js
│   └── package.json
└── client/
    ├── client.php
    └── composer.json (installed via Composer)
```

## 🚀 Server (Node.js MCP Server)

This server supports OpenAI, Claude.ai, Cursor, Windsurf etc.

### 📦 Requirements

- Node.js v16+ recommended
- npm (Node Package Manager)

### 📥 Install

```bash
cd server
npm install
```

### ▶️ Run

```bash
node server.js
```

> By default, the server listens on port `3000` at the endpoint `POST /mcp`.

## 🧠 Client (PHP + OpenAI)

### 📦 Requirements

- PHP 8.0+
- Composer

### 📥 Install

```bash
cd client
composer install
```

> This will install [`openai-php/client`](https://github.com/openai-php/client) and its dependencies.

### ⚙️ Configuration

Edit `client.php` and set your OpenAI API key:

```php
$this->openaiClient = OpenAI::client("your-openai-api-key");
```

Also make sure the `$mcpServerUrl` variable is correctly pointing to your MCP server (default: `http://localhost:3000/mcp` or your public server IP).

### ▶️ Run

```bash
php client.php
```

The PHP script will:

1. Fetch tools from the MCP server via a `tools/list` call.
2. Map them to OpenAI's expected function format.
3. Call the OpenAI chat completion endpoint using these tools.

## 🧪 Example Response

MCP server returns tools like:

```json
{
  "jsonrpc": "2.0",
  "result": {
    "tools": [
      {
        "name": "increment",
        "description": "Increments the counter by one.",
        "inputSchema": {
          "type": "object",
          "properties": {},
          "required": []
        }
      }
    ]
  },
  "id": "test"
}
```

The client converts this into the OpenAI-compatible format automatically.

## 🛠️ Stack

- Node.js (Express)
- PHP
- Composer
- [openai-php/client](https://github.com/openai-php/client)
- JSON-RPC 2.0

## 📄 License

MIT – use freely and customize as needed.


Ask if you need help!
