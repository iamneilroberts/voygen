# Contributing to TravelOps.ai

Thank you for your interest in contributing to TravelOps.ai! This document provides guidelines and information for contributors.

## 🎯 Project Vision

TravelOps.ai aims to be the world's first truly LLM-agnostic professional travel planning platform, providing travel agents with flexible AI capabilities and cost optimization.

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Git
- Continue.dev CLI
- API keys for AI providers (Anthropic, OpenAI, etc.)

### Development Setup

1. **Fork and clone the repository**
```bash
git clone https://github.com/YOUR_USERNAME/travelops-ai.git
cd travelops-ai
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment**
```bash
cp .env.example .env
# Edit .env with your API keys
```

4. **Start development server**
```bash
npm run dev
```

## 📋 Development Guidelines

### Code Style

We use TypeScript with strict mode enabled. Please follow these guidelines:

- **TypeScript**: Use explicit types, avoid `any`
- **React**: Functional components with hooks
- **Naming**: PascalCase for components, camelCase for functions
- **Imports**: Use absolute imports where possible

### Commit Messages

Follow conventional commit format:
```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or fixing tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(model-selector): add cost-optimized model selection
fix(mcp-client): handle connection timeouts gracefully
docs(readme): update installation instructions
```

### Branch Naming

- `feature/feature-name`: New features
- `fix/bug-description`: Bug fixes  
- `docs/documentation-update`: Documentation changes
- `refactor/component-name`: Code refactoring

## 🧪 Testing

### Running Tests

```bash
# Unit tests
npm test

# Coverage report
npm run test:coverage

# Watch mode
npm run test:watch
```

### Writing Tests

- Write tests for all new features
- Maintain 80%+ test coverage
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)

Example:
```typescript
describe('ModelSelector', () => {
  it('should select Haiku for simple queries under budget constraints', () => {
    // Arrange
    const selector = new ModelSelector();
    const query = createSimpleQuery();
    
    // Act
    const model = selector.selectOptimalModel(query);
    
    // Assert
    expect(model.name).toBe('claude-3-5-haiku');
  });
});
```

## 🏗️ Architecture Guidelines

### Model Provider Integration

All model providers must implement the `ModelProvider` interface:

```typescript
interface ModelProvider {
  name: string;
  query(prompt: string, options: QueryOptions): Promise<ModelResponse>;
  estimateCost(prompt: string): Promise<number>;
  checkHealth(): Promise<boolean>;
}
```

### MCP Server Standards

- All MCP servers must have health check endpoints
- Implement graceful degradation on failures
- Use appropriate timeouts (default: 30 seconds)
- Include structured logging

### Error Handling

- Use custom error types
- Provide meaningful error messages
- Log errors with context
- Implement retry logic where appropriate

## 📝 Documentation

### Code Documentation

- Document all public APIs with JSDoc
- Include usage examples
- Explain complex algorithms
- Update README for user-facing changes

### User Documentation

- Update user guides for new features
- Include screenshots for UI changes
- Provide troubleshooting information
- Keep getting started guide current

## 🔍 Pull Request Process

### Before Submitting

1. **Run the full test suite**: `npm test`
2. **Check code quality**: `npm run lint && npm run type-check`
3. **Update documentation** for any user-facing changes
4. **Test your changes** thoroughly
5. **Squash commits** if you have multiple small commits

### Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature  
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tests pass
- [ ] New tests added for new functionality
- [ ] Manual testing completed

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No merge conflicts
```

### Review Process

1. **Automated checks** must pass (tests, linting, type checking)
2. **At least one reviewer** approval required
3. **Maintainer review** for significant changes
4. **Squash and merge** preferred merge strategy

## 🐛 Bug Reports

### Before Reporting

1. **Search existing issues** to avoid duplicates
2. **Try the latest version** to see if the bug is fixed
3. **Check documentation** to ensure expected behavior
4. **Gather debugging information**

### Bug Report Template

```markdown
## Bug Description
Clear description of the bug

## Steps to Reproduce
1. Go to...
2. Click on...
3. See error

## Expected Behavior
What should happen

## Actual Behavior  
What actually happens

## Environment
- OS: 
- Node version:
- Browser (if applicable):
- Continue.dev version:

## Additional Context
Screenshots, logs, etc.
```

## 💡 Feature Requests

### Before Requesting

1. **Check existing issues** and discussions
2. **Consider the project scope** and goals
3. **Think about implementation** complexity
4. **Prepare a strong use case**

### Feature Request Template

```markdown
## Feature Description
Clear description of the requested feature

## Use Case
Why is this feature needed?

## Proposed Solution
How should this feature work?

## Alternatives Considered
Other approaches you've thought about

## Additional Context
Mockups, examples, etc.
```

## 🚀 Release Process

### Versioning

We use semantic versioning (SemVer):
- **MAJOR**: Breaking changes
- **MINOR**: New features (backwards compatible)
- **PATCH**: Bug fixes (backwards compatible)

### Release Checklist

1. Update version in `package.json`
2. Update CHANGELOG.md
3. Tag the release
4. Deploy to staging for testing
5. Deploy to production
6. Announce the release

## 🤝 Community Guidelines

### Code of Conduct

- **Be respectful** and inclusive
- **Help others** learn and grow
- **Provide constructive feedback**
- **Focus on the code**, not the person
- **Assume good intentions**

### Communication

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: Questions and community discussions  
- **Pull Request Comments**: Code review and technical discussion
- **Discord/Slack**: Real-time communication (if available)

## 🏆 Recognition

We appreciate all contributions! Contributors will be:

- Listed in the project README
- Mentioned in release notes
- Invited to contributor discussions
- Given appropriate repository permissions

## ❓ Questions?

- **General questions**: GitHub Discussions
- **Technical questions**: GitHub Issues  
- **Private matters**: Email the maintainers
- **Security issues**: Follow responsible disclosure

## 📚 Resources

- [Development Standards](.project/guidelines/DEVELOPMENT-STANDARDS.md)
- [Architecture Documentation](.project/architecture/)
- [Project Roadmap](ROADMAP.md)
- [Getting Started Guide](docs/getting-started.md)

---

**Thank you for contributing to TravelOps.ai!** 🎉

Your contributions help make travel planning more accessible and cost-effective for travel professionals worldwide.