# makecli CLI Reference

## Global Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--server-url` | Meta Server base URL | config value or `https://dev-make.qtech.cn/api/make` |

Most subcommands also accept `--profile <name>` (default: `"default"`).

---

## configure

Manages credentials (`~/.make/credentials`) and config (`~/.make/config`). Both files use INI format with `[profile]` sections, permissions 0600.

### configure token

```
makecli configure token [--profile <name>]
```

Interactive prompt for access token (JWT). Masked input (last 4 chars visible). Empty input preserves current value.

**INTERACTIVE** — cannot be run by agent. User must run via `!`.

### configure config

```
makecli configure config [--profile <name>]
```

Interactive prompts for: `server-url`, `X-Tenant-ID`, `X-Operator-ID`.

**INTERACTIVE** — cannot be run by agent. User must run via `!`.

### configure set

```
makecli configure set <key> <value> [--profile <name>]
```

Non-interactive. Valid keys: `server-url`, `X-Tenant-ID`, `X-Operator-ID`.

### configure get

```
makecli configure get <key> [--profile <name>]
```

Reads a single config value. Valid keys: `server-url`, `X-Tenant-ID`, `X-Operator-ID`.

### configure verify

```
makecli configure verify [--output table|json] [--profile <name>]
```

Verify that the current profile has a valid token. Use this to check environment readiness before running other commands.

---

## app

### app create

```
makecli app create <name> [--code <value>] [--profile <name>]
```

- `name`: required, positional
- `--code`: app code identifier (defaults to name)

### app list

```
makecli app list [--page <n>] [--size <n>] [--output table|json] [--profile <name>]
```

- Table columns: NAME, CODE, VERSION
- Footer: `Showing X of Y apps`

### app init

```
makecli app init <folder> [--provider <name>]
```

- `folder`: required, must exist
- `--provider`: `anthropic` (CLAUDE.md), `openai` (AGENTS.md), `google` (GEMINI.md), `cursor` (.cursorrules). Default: `anthropic`
- Fails if target file already exists

### app delete

```
makecli app delete <name> [--profile <name>]
```

---

## entity

All subcommands require `--app <app-name>`.

### entity create

```
makecli entity create <name> --app <app> [--json <path>] [--profile <name>]
```

- `--json`: path to JSON file with fields array (optional)
- JSON format:
  ```json
  [
    {
      "name": "fieldName",
      "type": "string",
      "meta": {},
      "properties": {},
      "validations": {}
    }
  ]
  ```
- Field names cannot start with `_`

### entity list

```
makecli entity list [<entity-name>] --app <app> [--page <n>] [--size <n>] [--output table|json] [--profile <name>]
```

- Without entity-name: list view (NAME, VERSION columns)
- With entity-name: detail view (Name, App, Version + Fields table: NAME, TYPE)

### entity delete

```
makecli entity delete <name> --app <app> [--profile <name>]
```

---

## relation

All subcommands require `--app <app-name>`.

### relation create

```
makecli relation create <name> --app <app> --json <path> [--profile <name>]
```

- `--json`: required, JSON file with relation definition
- JSON format:
  ```json
  {
    "from": { "entity": "EntityA", "cardinality": "one" },
    "to": { "entity": "EntityB", "cardinality": "many" }
  }
  ```
- Cardinality values: `"one"` or `"many"`

### relation update

```
makecli relation update <name> --app <app> --json <path> [--profile <name>]
```

Same JSON format as create.

### relation list

```
makecli relation list [<relation-name>] --app <app> [--page <n>] [--size <n>] [--output table|json] [--profile <name>]
```

- Without name: list view (NAME, FROM, TO, VERSION). From/To format: `Entity(cardinality)`
- With name: detail view (Name, App, Version, From details, To details)

### relation delete

```
makecli relation delete <name> --app <app> [--profile <name>]
```

---

## schema

```
makecli schema --app <app> [--profile <name>]
```

Get aggregated schema for an app (app + entities + relations in one view).

- `--app`: required, app name
- Output: complete schema definition including all entities and relations

---

## apply

```
makecli apply -f <path> [--profile <name>]
```

Batch apply resources from YAML files (create-or-update semantics).

- `-f, --file`: required, path to YAML file or directory
- **File input:** reads all YAML documents (separated by `---`)
- **Directory input:** scans one level for `.yaml`/`.yml` files, skips dotfiles
- **Processing order:** App -> Entity -> Relation (auto-sorted regardless of file order)
- **Semantics:**
  - App: create if not exists, skip if exists (no update)
  - Entity: create if not exists, update if exists
  - Relation: create if not exists, update if exists
- **Output:** per resource `<Type> '<name>' <action>`, summary `Applied <count> resources successfully`
- **Error:** stops on first error with context

---

## diff

```
makecli diff -f <path> [--output table|json] [--profile <name>]
```

Compare local DSL YAML with remote Meta Server definitions.

- `-f, --file`: required, path to YAML file or directory
- **App inference:** Make.App name > first entity's app > first relation's app
- **Diff statuses:** `added` (local only), `removed` (remote only), `changed` (both, differ), `unchanged`
- **Table output:**
  ```
  App: AppName

  Entities:
    ~ EntityName
      + fieldName: type (only in local)
      - fieldName: type (only on server)
    + NewEntity (only in local)
    - OldEntity (only on server)

  Relations:
    ~ RelationName
      from: Entity(card) -> Entity(card)

  Summary: X changed, Y added, Z removed, W unchanged
  ```
- **Exit codes:** 0 = no differences, 1 = differences found

---

## update

```
makecli update
```

Self-update to latest version from GitHub Releases. No flags.

---

## version

```
makecli version
```

Display version: `makecli version X.Y.Z (build-date)`.
