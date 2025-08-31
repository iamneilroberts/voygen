# Voygen - AI Travel Agent with LibreChat

**Professional AI-Powered Travel Assistant with LibreChat Integration**

Voygen is a complete travel planning system built on LibreChat with Model Context Protocol (MCP) integration. It provides travel agents with a familiar chat interface and powerful AI assistant capabilities including browser automation, client management, and real-time travel data extraction.

![Voygen Travel Agent](assets/voygen-screenshot.png)

## 🚀 Quick Start

### Prerequisites

1. **LibreChat** must be installed on your system
   - [LibreChat Installation Guide](https://docs.librechat.ai/install/installation/docker_compose_install.html)
   - Alternatively: [Local Installation](https://docs.librechat.ai/install/installation/local_install.html)

2. **MongoDB** - Required by LibreChat
   - Local installation or MongoDB Atlas

3. **Node.js 18+** - For MCP servers and build tools

4. **Chrome/Chromium** - Required for web automation (mcp-chrome)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/iamneilroberts/voygen.git
   cd voygen
   ```

2. **Run setup script**
   ```bash
   ./scripts/setup.sh
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys (see Configuration section)
   ```

4. **Start Voygen**
   ```bash
   npm run start
   ```

5. **Access the interface**
   - Open your browser to `http://localhost:3080`
   - Create an account or log in
   - Start planning travel with AI assistance!

## 🔧 Configuration

### Required API Keys

Edit your `.env` file with the following:

```bash
# AI Model API Keys (at least one required)
ANTHROPIC_API_KEY=sk-ant-api03-...
OPENAI_API_KEY=sk-...

# LibreChat Configuration
MONGODB_URI=mongodb://127.0.0.1:27017/voygen
JWT_SECRET=your-secret-key-here

# Chrome Path (auto-detected on most systems)
CHROME_PATH=/usr/bin/google-chrome
```

### MCP Server Configuration

The system uses four core MCP servers:

- **mcp-chrome**: Browser automation for real-time web data
- **d1-database**: Client and trip management database  
- **prompt-instructions**: Travel planning workflows
- **github-mcp**: Document publishing system

Configuration is handled automatically via `config/librechat-minimal.yaml`.

## 🎯 Key Features

### Browser Automation
- Real-time travel website interaction
- Price monitoring and availability checks
- Screenshot capture for confirmation
- Form filling and booking assistance

### Travel Database
- Comprehensive client management
- Trip planning and tracking
- Cost estimation and budgeting
- Workflow state management

### Document Generation
- Professional HTML travel proposals
- Automated publishing to GitHub Pages
- Template-based document creation
- Multi-media content support

### Cost-Effective AI
- Intelligent model selection (Haiku for routine tasks, Sonnet for complex planning)
- 12x cost savings compared to premium-only solutions
- Sub-second response times
- Multi-provider support (Anthropic, OpenAI)

## 📁 Project Structure

```
voygen/
├── librechat-source/           # LibreChat integration
├── mcp-local-servers/          # Local MCP servers
│   └── mcp-chrome/            # Browser automation
├── remote-mcp-servers/         # Cloud-deployed MCP servers
│   ├── d1-database-improved/   # Database management
│   ├── prompt-instructions-d1-mcp/  # Workflow management
│   ├── github-mcp-cta/        # Document publishing
│   └── template-document-mcp/  # Template rendering
├── config/                     # Configuration files
│   └── librechat-minimal.yaml # LibreChat MCP configuration
├── scripts/                    # Setup and utility scripts
├── docs/                       # Documentation
├── testing/                    # Test files and examples
└── assets/                     # Images and templates
```

## 🛠️ Development

### Local Development

1. **Start development mode**
   ```bash
   npm run dev
   ```

2. **Test MCP servers**
   ```bash
   # Test individual MCP server
   cd mcp-local-servers/mcp-chrome
   npm test
   
   # Test all servers
   npm run test:mcp
   ```

3. **Deploy MCP servers**
   ```bash
   # Deploy to Cloudflare Workers
   cd remote-mcp-servers/d1-database-improved
   npm run deploy
   ```

### Adding New MCP Servers

1. Create server in `mcp-local-servers/` or `remote-mcp-servers/`
2. Add configuration to `config/librechat-minimal.yaml`
3. Update documentation and tests

## 🔍 Usage Examples

### Starting a Travel Planning Session

1. **Initialize the system**
   ```
   /start
   ```

2. **Create a new client and trip**
   ```
   I need to plan a 7-day trip to Italy for the Johnson family (2 adults, 1 child) 
   departing March 15th. Budget is $8000.
   ```

3. **Research and extract live data**
   ```
   Can you check current flight prices from NYC to Rome for those dates?
   ```

4. **Generate professional proposal**
   ```
   /publish - Create a travel proposal document
   ```

### Continuing Work on Existing Trips

```
/continue Johnson Italy trip
```

## 🧪 Testing

The system includes comprehensive testing:

- **Unit tests**: Individual MCP server functionality
- **Integration tests**: End-to-end workflow testing
- **Performance tests**: Response time and reliability
- **User acceptance tests**: Real-world travel planning scenarios

Run tests:
```bash
npm test                 # All tests
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests
npm run test:e2e         # End-to-end tests
```

## 🚀 Deployment

### Production Deployment

1. **Set up production environment**
   ```bash
   cp .env.example .env.production
   # Configure production API keys and database URLs
   ```

2. **Deploy MCP servers to Cloudflare**
   ```bash
   npm run deploy:mcp
   ```

3. **Deploy LibreChat**
   - Follow LibreChat production deployment guide
   - Use `config/librechat-minimal.yaml` for MCP configuration

### Environment-Specific Configurations

- **Development**: Uses local MCP servers where possible
- **Staging**: Mix of local and remote servers for testing
- **Production**: All MCP servers deployed to Cloudflare Workers

## 📊 Performance & Monitoring

### Cost Optimization
- Haiku 3.5 for routine tasks: ~$0.25/1M tokens
- Sonnet 3.5 for complex planning: ~$3.00/1M tokens
- Intelligent routing saves 12x compared to premium-only solutions

### Monitoring
- Built-in performance metrics
- Cost tracking per conversation
- MCP server health monitoring
- User activity analytics

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup for Contributors

1. Fork the repository
2. Create a feature branch
3. Set up development environment: `./scripts/setup.sh`
4. Make changes and test thoroughly
5. Submit pull request

## 📖 Documentation

- [Architecture Overview](docs/architecture.md)
- [MCP Server Development](docs/mcp-development.md)
- [API Reference](docs/api/)
- [Troubleshooting Guide](docs/troubleshooting.md)

## ❗ Troubleshooting

### Common Issues

**MCP Server Connection Failed**
```bash
# Check server status
npx mcp-remote https://d1-database-improved.somotravel.workers.dev/sse
```

**LibreChat Won't Start**
- Ensure MongoDB is running
- Check `.env` configuration
- Verify Node.js version (18+)

**Browser Automation Issues**
- Install Chrome/Chromium
- Check `CHROME_PATH` in `.env`
- Ensure proper permissions

### Getting Help

- [GitHub Issues](https://github.com/iamneilroberts/voygen/issues)
- [Documentation](docs/)
- [Discord Community](https://discord.gg/voygen)

## 🔗 Related Projects

- **[LibreChat](https://github.com/danny-avila/LibreChat)** - Base platform
- **[Claude Travel Agent](https://github.com/iamneilroberts/claude-travel-agent-v2)** - Original Claude Desktop version
- **[MCP-Chrome](https://github.com/hangwin/mcp-chrome)** - Browser automation server

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🌟 Acknowledgments

- LibreChat team for the excellent foundation platform
- Anthropic for Claude models and MCP protocol
- Travel industry professionals who provided feedback and requirements

---

**Voygen - Your AI travel companion for professional excellence.**

*Transform your travel planning workflow with intelligent AI assistance.*