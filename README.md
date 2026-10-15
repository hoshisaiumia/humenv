# humenv

CLI that generates `.env`, `.local.env` and `.env.example` files per service and keeps your `.gitignore` up to date.

## Usage

```bash
npx humenv
```

```
Envs to be created (separate with comma): web, database
Variables for web (separate with comma): PORT, API_URL
Variables for database (separate with comma): DB_URL
```

Result (default directory `env/`):

```
env/web.local.env        PORT=      API_URL=
env/web.env              PORT=      API_URL=
env/web.env.example      PORT=change_this_to_your_variable  API_URL=change_this_to_your_variable
env/database.local.env   DB_URL=
env/database.env         DB_URL=
env/database.env.example DB_URL=change_this_to_your_variable
```

If a file already exists, only the missing variables are appended to the end. Existing values are never changed.

## Options

| Option             | Description                                                                            |
| ------------------ | -------------------------------------------------------------------------------------- |
| `-d, --dir <path>` | Directory for the env files (default: `env`)                                           |
| `-a, --avoid`      | Don't ask for variable names (files are created empty)                                 |
| `-e, --edit`       | Edit existing envs: pick one with the arrow keys, then add, remove or rename variables |
| `-h, --help`       | Show help                                                                              |

```bash
humenv --dir . --avoid
```

## Editing existing envs

```bash
humenv --edit
humenv --edit --dir config
```

1. Pick an env from the list (`↑`/`↓` and `Enter`).
2. Choose an action:
   - **Add variables**: appended to the end of each file, existing values untouched.
   - **Remove variables**: select with `Space`, then confirm. The variables (and their values) are removed from all three files.
   - **Rename a variable**: renamed in all three files, keeping its value.

Requires an interactive terminal. Press `Ctrl+C` at any time to cancel without changes.

## .gitignore

The rule matching the chosen directory is added automatically (`env/*.env`, or `*.env` with `--dir .`). `.env.example` files stay tracked.

## Requirements

Node.js 20.12 or newer.

## Development

```bash
npm install
npm run dev        # run without building
npm run typecheck
npm test
npm run build
```

## License

MIT
