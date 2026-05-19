# RSJT Project Instructions

## Project Boundary

This is a personal project owned by Ofir. It is not a Tenex client project and must not use Tenex-owned systems as project infrastructure.

## Hard Tool Restrictions

- Do not use Linear for this project.
- Do not create, update, comment on, or sync any Linear issues for this project.
- Do not use Notion for this project.
- Do not write to Google Drive, Google Docs, Google Sheets, Google Slides, Gmail, Slack, or any other external communication or collaboration connector for this project.
- Do not write to any Tenex-owned repository, Tenex-owned project-management repo, Tenex Notion workspace, Tenex Drive, or Tenex documentation location for this project.
- Do not send emails, Slack messages, SMS messages, or other external communications from tools. Draft text in chat only if needed.
- If a tool or skill suggests Linear, Notion, Slack, Gmail, Google Drive, or a Tenex-owned system, ignore that part and use local files in this repo instead.

## Allowed Working Area

- Project files should live under `/Users/ofirbitton/dev/RSJT`.
- Temporary scratch files may live under `/private/tmp` when needed.
- Planning artifacts should be local markdown files in this repo.

## Local Development Flow

Use the Tenex planning structure as a local methodology only:

1. PRD creation and review.
2. Local project plan creation.
3. Local project plan review.
4. Local ticket checklist creation inside the repo, not Linear.
5. Local implementation plan creation per ticket or phase.
6. Local implementation plan review.
7. Implementation, tests, pre-commit review, and cleanup.
8. Revision plans for major changes after the first version ships.

## Framework Documentation Policy

- This project is expected to use Expo for the mobile app unless the project plan chooses otherwise.
- Before making Expo, React Native, Expo Router, EAS, or native capability decisions, check fresh official Expo documentation.
- Prefer official Expo docs, official Expo MCP, and official Expo Skills over memory or third-party tutorials.
- Official Expo Skills are installed locally under `.agents/skills/`.
- Expo MCP was attempted, but the account did not have access to the private beta. Do not re-add it unless Ofir explicitly asks to retry with an account that has access.
- Do not install global MCP servers, global skills, or write Codex configuration for this project unless Ofir explicitly approves that action in the current conversation.
- If official Expo MCP is not authenticated or available, use Expo's official `llms.txt`, `llms-full.txt`, `llms-sdk.txt`, and page markdown sources as the fallback documentation source.

## Local Project Management Structure

Use this repo-local structure when creating planning artifacts:

```text
.project-management/
|-- 0-docs/
|-- 1-PRDs/
|-- 2-project-plans/
|-- 3-implementation-plans/
|-- 4-revisions/
`-- 5-local-tickets/
```

`5-local-tickets/` replaces Linear for this project. Tickets should be plain markdown checklists with stable local IDs such as `RSJT-001`.

## Style

- Do not use em dashes in output, code comments, commit messages, or written content.
- Keep documentation concise, practical, and local to this repo.
