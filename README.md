# Glowforest

A shareable mod list for RimWorld. Turn a save into a page listing every mod, in load order, with Steam Workshop details.

- Drop a `.rws` save, a `.rml` mod-list export, or `ModsConfig.xml` — or paste a Workshop collection URL.
- Extraction happens in your browser and reads only the mod-list header: the colony never leaves your device.
- Published lists are unlisted: reachable by link, not indexed or browsable.
- Long lists stay usable: search by mod, author, package ID, or note; filter to unresolved, outdated, or noted mods; switch between detailed cards and a three-column brief table; copy the visible list as text.
- Every page follows your system theme, and a header control remembers a light or dark choice.
- Editing needs a one-time edit link; no account.

Live at [glowforest.ihatenoise.workers.dev](https://glowforest.ihatenoise.workers.dev).

## Development

```
pnpm install
pnpm dev
pnpm test
```

Deployment, rollback, and loading the community package index are described in [docs/operations.md](docs/operations.md).

Mod metadata comes from Steam Workshop; package IDs from the RimSort Steam Workshop Database. Unofficial — RimWorld is a trademark of Ludeon Studios.

## License

[MIT](LICENSE)
