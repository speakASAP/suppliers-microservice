# Agents: suppliers-microservice


## Required Reading
Read AGENTS.md, TASKS.md, STATE.json, BUSINESS.md, SYSTEM.md, and applicable architecture and operations documentation.

## Authority
Approved repository source and documentation are authoritative; do not infer undocumented integrations.

## Service-to-service authentication
Any call this service makes to, or receives from, another service is governed by
[`auth-microservice/docs/SERVICE_IDENTITY_CONSUMER_STANDARD.md`](../auth-microservice/docs/SERVICE_IDENTITY_CONSUMER_STANDARD.md).
Read it before writing or debugging a machine call — including a 401 from an internal
endpoint. New machine paths use an Auth-issued per-pair RS256 service JWT; a shared static
token is legacy and closed to new adopters.

## Intent Preservation System
Preserve Vision through Goal Impact, System, Feature, Task, Execution Plan, Coding Prompt, Code, and Validation.

## Safety and Operations
Never print secrets, credentials, raw production data, or private evidence; follow the remote repository operating rules.

## Project-Specific Rules
Preserve this repository ownership boundary: Supplier API imports and supplier data integration for the e-commerce ecosystem.

## Required Final Report
Report changed files, validation evidence, debt, blockers, deviations, and next action.
