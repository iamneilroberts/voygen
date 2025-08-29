# Voygen

**AI-Powered Travel Assistant with LibreChat Integration**

Voygen is a professional travel planning system built on **LibreChat** with Model Context Protocol (MCP) integration, designed to provide travel agents with a familiar chat interface and powerful AI assistant capabilities including browser automation and real-time travel data.

## 🎯 Vision

Create a powerful AI travel assistant that gives travel professionals the tools they need:
- Browser automation for real-time travel data extraction
- Comprehensive travel database with client and trip management
- Professional LibreChat interface with travel-specific enhancements
- Seamless deployment on Vercel with voygen.app domain

## 🚀 Key Features

- **Browser Automation**: MCP-Chrome integration for real-time web scraping and travel site interaction
- **Travel Database**: Comprehensive client and trip management with D1 database backend
- **Professional Chat Interface**: LibreChat-powered interface optimized for travel professionals
- **Remote MCP Servers**: Cloud-hosted tools for database access and prompt management
- **Real-Time Status**: Live workflow tracking and trip progress indicators
- **Document Generation**: HTML travel proposals with multimedia content

## 🏗️ Architecture

Built on top of LibreChat's enterprise-ready chat platform with:
- **Core Engine**: LibreChat with custom travel agent configurations and MCP integration
- **Model Abstraction Layer**: Native multi-provider support with intelligent cost optimization
- **Professional Chat UI**: Familiar ChatGPT-style interface customized for travel professionals  
- **MCP Server Integration**: Native 2024 MCP protocol support for existing travel planning tools
- **Database Layer**: MongoDB for chat history, cost tracking, workflow state, and client management

## 📋 Project Status

**Current Phase**: Evaluation and Architecture Design

- [x] Research MCP-compatible platforms  
- [x] Analyze Continue.dev vs LibreChat feasibility
- [x] **Strategic Decision: LibreChat Foundation** (multi-AI expert consensus)
- [ ] Set up LibreChat development environment
- [ ] Create proof-of-concept integration
- [ ] Develop professional UI mockups
- [ ] Implement model switching logic
- [ ] Migrate existing MCP servers
- [ ] Build cost optimization system

## 🎯 Target Users

- **Professional Travel Agents**: Primary users requiring structured workflows and cost efficiency
- **Travel Agencies**: Organizations needing scalable AI assistance with budget control
- **Enterprise Travel Managers**: Corporate travel planning with compliance and reporting
- **Travel Tech Companies**: Integration partners and white-label deployments

## 💼 Business Value

- **12x Cost Savings**: Using Haiku 3.5 for routine tasks vs premium models
- **Speed Advantages**: Sub-second responses for competitive advantage
- **Scalability**: Handle high-volume operations with cost-effective model selection
- **Flexibility**: No vendor lock-in, choose optimal models for each task
- **Professional Tools**: Purpose-built for travel industry workflows

## 🛠️ Technology Stack

- **Base Platform**: LibreChat (open-source ChatGPT alternative)
- **AI Models**: Anthropic Claude, OpenAI GPT, Google Gemini, Local models  
- **Protocol**: Model Context Protocol (MCP) - Native 2024 support
- **Frontend**: React with Tailwind CSS (LibreChat's proven stack)
- **Backend**: Node.js with native MCP server integration
- **Database**: MongoDB (chat history) + D1 (travel data) + Redis (caching)
- **Deployment**: Docker containers, Cloudflare Workers for MCP servers

## 📂 Project Structure

```
voygen/
├── librechat-source/       # LibreChat integration with MCP servers
├── mcp-local-servers/      # Local MCP servers (will include mcp-chrome)
├── docs/                   # Documentation and guides
├── assets/                 # Images and templates
├── testing/                # Test files and screenshots
├── scripts/                # Development and deployment scripts
├── package.json            # Project configuration
├── vercel.json            # Vercel deployment configuration
└── README.md              # This file
```

## 🚀 Quick Start

*Coming soon - development environment setup*

## 📖 Documentation

- [Architecture Overview](docs/architecture.md)
- [Development Guide](docs/development.md)
- [API Reference](docs/api/)
- [User Guide](docs/guides/)

## 🤝 Contributing

This project is in early development. Contribution guidelines will be established once the core architecture is defined.

## 📄 License

*License to be determined*

## 🔗 Related Projects

- **Claude Travel Agent**: Original Claude Desktop-based system (CTA)
- **LibreChat**: Open-source ChatGPT alternative with enterprise features
- **MCP-Chrome**: Browser automation for AI assistants

---

**Voygen - Your AI travel companion for professional excellence.**