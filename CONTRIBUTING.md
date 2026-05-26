# Contributing

Thanks for your interest in Bedrock Server Manager!

## Before You Submit a Pull Request

1. Run `npm run typecheck` and ensure no type errors.
2. Run `npm run test` and ensure all tests pass.
3. If you added a feature, consider adding a test for it.

## Architecture

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) before making changes. It explains:

- Project layout (server/backend, client/frontend, shared types)
- Data flow (pages → API client → routes → services)
- How the DI container, event bus, and operation lock work
- How to add new API routes, new services, or new pages

## Reporting Issues

Bug reports and feature requests are welcome via [GitHub Issues](https://github.com/Vortexstbloons/bedrock-server-manager/issues).

Please include:

- A clear title and description
- Steps to reproduce (for bugs)
- Expected vs actual behavior
- Screenshots if applicable
- Your Node.js version (`node --version`)
