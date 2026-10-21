# Fonts

## nerd-symbols.woff2

A single-glyph subset of `SymbolsNerdFont-Regular.ttf` from the Nerd Fonts
release v3.5.1 (https://github.com/ryanoasis/nerd-fonts), reduced to
`nf-md-progress_question` (U+F1522, Material Design Icons) with
`subset-font` in woff2 format. Used to mark unresolved mods on the showcase page.

Regenerate with:

```sh
curl -sLO https://github.com/ryanoasis/nerd-fonts/releases/download/v3.5.1/NerdFontsSymbolsOnly.zip
unzip -oq NerdFontsSymbolsOnly.zip SymbolsNerdFont-Regular.ttf
npx --yes --package=subset-font node -e "require('subset-font')(require('fs').readFileSync('SymbolsNerdFont-Regular.ttf'),'\u{f1522}',{targetFormat:'woff2'}).then((b) => require('fs').writeFileSync('public/fonts/nerd-symbols.woff2', b))"
```

Nerd Fonts is MIT licensed (see `LICENSE-nerd-fonts.txt`). Material Design
Icons, the source of this glyph, is Apache-2.0 licensed
(https://github.com/google/material-design-icons).
