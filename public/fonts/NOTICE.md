# Fonts

## nerd-symbols.woff2

A three-glyph subset of `SymbolsNerdFont-Regular.ttf` from the Nerd Fonts
release v3.5.1 (https://github.com/ryanoasis/nerd-fonts), reduced with
`subset-font` to woff2:

| Codepoint | Glyph | Used for |
|---|---|---|
| U+F1522 | `nf-md-progress_question` | unresolved-mod marker |
| U+F522 | `nf-oct-sun` | light side of the theme switch |
| U+F4EE | `nf-oct-moon` | dark side of the theme switch |

Regenerate with:

```sh
curl -sLO https://github.com/ryanoasis/nerd-fonts/releases/download/v3.5.1/NerdFontsSymbolsOnly.zip
unzip -oq NerdFontsSymbolsOnly.zip SymbolsNerdFont-Regular.ttf
npx --yes --package=subset-font node -e "require('subset-font')(require('fs').readFileSync('SymbolsNerdFont-Regular.ttf'),'\u{f522}\u{f4ee}\u{f1522}',{targetFormat:'woff2'}).then((b) => require('fs').writeFileSync('public/fonts/nerd-symbols.woff2', b))"
```

Nerd Fonts is MIT licensed (see `LICENSE-nerd-fonts.txt`). Material Design
Icons (`nf-md-*`) is Apache-2.0 licensed
(https://github.com/google/material-design-icons); Octicons (`nf-oct-*`) is
MIT licensed (https://github.com/primer/octicons).
