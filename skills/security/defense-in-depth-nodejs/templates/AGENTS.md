## Safe Chain

Package installs in this environment go through Aikido Safe Chain shims. Never bypass them:

- Keep `~/.safe-chain/shims` first on `PATH`.
- Do not call unshimmed `npm`, `pnpm`, `npx`, or `pnpx`.
- Do not install packages with `curl | sh` or by pointing at a package manager outside the shim directory.
