# Framework Documentation Sources

Last checked: 2026-05-18

## Decision

Expo framework work must be checked against fresh official Expo documentation before project planning or implementation. Do not rely on model memory for Expo APIs, SDK versions, routing behavior, EAS behavior, native modules, config plugins, or development-build behavior.

## Official Sources

- Expo MCP Server: https://docs.expo.dev/eas/ai/mcp/
- Expo Skills: https://docs.expo.dev/skills/
- Expo AI documentation access: https://docs.expo.dev/llms/
- Expo documentation index for agents: https://docs.expo.dev/llms.txt
- Expo complete documentation bundle: https://docs.expo.dev/llms-full.txt
- Expo latest SDK documentation bundle: https://docs.expo.dev/llms-sdk.txt
- Expo latest SDK reference: https://docs.expo.dev/versions/latest/

## Expo MCP

Official Expo MCP exists and is the preferred live-docs path if the account and tool environment support it.

- Server type: Streamable HTTP
- URL: `https://mcp.expo.dev/mcp`
- Authentication: OAuth
- Codex setup command from Expo docs: `codex mcp add expo-mcp --url https://mcp.expo.dev/mcp`
- Requirement: Expo account with an EAS paid plan.
- Local capabilities require SDK 54 or later plus the `expo-mcp` package in the Expo project.

Do not run the setup command without explicit approval because it writes to Codex configuration and triggers Expo authentication.

Status on 2026-05-18: attempted setup in Codex, but Expo returned that the MCP server is in private beta and the account does not have access. The failed `expo-mcp` Codex entry was removed after the attempt.

## Expo Skills

Official Expo Skills exist and can be installed into compatible agents.

- Install command from Expo docs: `npx skills add expo/skills`
- Examples include skills for native UI, Expo Router API routes, EAS workflows, deployment, dev clients, native modules, Tailwind setup, data fetching, and upgrading Expo.

Status on 2026-05-18: installed locally for this project under `.agents/skills/`.

Installed skills:

- `building-native-ui`
- `eas-update-insights`
- `expo-api-routes`
- `expo-cicd-workflows`
- `expo-deployment`
- `expo-dev-client`
- `expo-module`
- `expo-tailwind-setup`
- `expo-ui-jetpack-compose`
- `expo-ui-swiftui`
- `native-data-fetching`
- `upgrading-expo`
- `use-dom`

## Fallback When MCP Is Not Available

Use official docs directly:

1. Start with `https://docs.expo.dev/llms.txt` to discover the right page or bundle.
2. Use `https://docs.expo.dev/llms-sdk.txt` for latest SDK APIs.
3. Use per-page markdown by appending `.md` or `/index.md` to an Expo docs page URL.
4. Cite the source used in planning docs when the decision depends on current Expo behavior.

## Current Version Note

As of the latest official SDK reference checked on 2026-05-18, Expo SDK 55 maps to React Native 0.83, React 19.2, and minimum Node.js 20.19.x. Verify again before scaffolding the app.

Implementation check on 2026-05-18: `pnpm create expo apps/mobile --no-install --no-agents-md --yes` generated an SDK 55 default Expo Router app with Expo `~55.0.24`, React Native `0.83.6`, and React `19.2.0`.
