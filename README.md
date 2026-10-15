# envgen

CLI that generates `.env`, `.local.env` and `.env.example` files per service and keeps your `.gitignore` up to date.

## Usage

```bash
npx envgen
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
env/database.env.example DB_URL=changeme
```

If a file already exists, only the missing variables are appended to the end. Existing values are never changed.

## Options

| Option             | Description                                            |
| ------------------ | ------------------------------------------------------ |
| `-d, --dir <path>` | Directory for the env files (default: `env`)           |
| `-a, --avoid`      | Don't ask for variable names (files are created empty) |
| `-h, --help`       | Show help                                              |

```bash
envgen --dir . --avoid
```

## .gitignore

The rule matching the chosen directory is added automatically (`env/*.env`, or `*.env` with `--dir .`). `.env.example` files stay tracked.

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
