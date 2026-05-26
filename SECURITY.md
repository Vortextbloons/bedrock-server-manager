# Security Policy

## Intended Use

This software is designed for use on **trusted local networks only**. It operates as a local web dashboard for managing a Minecraft Bedrock Dedicated Server and is not intended to be exposed to the public internet.

## Authentication

This project has **no built-in authentication**. The dashboard should not be exposed to untrusted networks without placing it behind a reverse proxy with authentication (e.g., nginx with Basic Auth, or a VPN).

## What Information Is Exposed

- `GET /api/info` — Dashboard port, LAN host addresses, Minecraft port
- `GET /api/config` — Resolved server paths and current configuration values

These endpoints are designed for convenience on a local network.

## Reporting a Vulnerability

Please report security issues via [GitHub Issues](https://github.com/Vortexstbloons/bedrock-server-manager/issues). There is no private reporting channel at this time.
