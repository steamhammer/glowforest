## 1. Font loading

- [x] 1.1 Replace per-render font fetching with a module-level cached promise, retrying after a failure
- [x] 1.2 Load only the Regular face and pass a single buffer to the renderer with `defaultFontFamily: "Lato"`

## 2. Card typography

- [x] 2.1 Remove the `font-weight="700"` attributes and rebalance the eyebrow and title with size, letter spacing, and colour
- [ ] 2.2 Render the current production cards and confirm the title still reads as the strongest element at 1200x630

## 3. Assets

- [ ] 3.1 Delete `public/fonts/Lato-Bold.ttf` and confirm nothing else references it
- [ ] 3.2 Update `public/fonts/NOTICE.md` to describe the single face and the no-bold constraint

## 4. Verification

- [ ] 4.1 Add a test proving two consecutive renders fetch the font once, and that a failed fetch is retried
- [ ] 4.2 Confirm the existing preview-card tests still pass (render, cache, refresh after edit)
- [ ] 4.3 Run the full suite and typecheck
- [ ] 4.4 After deploy, regenerate one live preview and check the image and its size
