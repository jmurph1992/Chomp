# Chomp — Claude Guidelines

## Documentation
All project documentation lives in `/docs`. Start there.
- Architecture, stack decisions, schema: `/docs/architecture/`
- Feature documentation: `/docs/features/`
- Table of contents: `/docs/README.md`

## Rules — Follow These Without Exception

**Plan first.** Always present a written plan and get approval before writing any code.

**Ask questions first.** Before building any feature, ask every question needed to build it correctly. Push back with a better solution when you have one — do not silently implement something suboptimal.

**Tests required.** Every new feature or code change must include tests. No exceptions.

**Security by default.** Every plan must include security considerations: input validation, auth checks, injection prevention, least-privilege data access.

**Modular code only.** No mega files. Split by responsibility. If a file is getting large, it's a signal to break it up.

**Comment everything.** Assume a junior developer will read this code. Components, functions, and non-obvious logic must have clear comments explaining what and why.

**Never run migrations without asking.** Always present the migration plan and wait for explicit approval before running it.

**Handoff required.** At the end of every session, update `HANDOFF.md` with enough context to resume work immediately in a future session.

**Best practices always.** Follow established conventions for every language, framework, and tool in the stack.

## Quick Reference
- Stack: `/docs/architecture/stack.md`
- Database schema: `/docs/architecture/schema.md`
- Feature docs: `/docs/features/`
