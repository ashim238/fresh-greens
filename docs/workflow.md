# Building a screen — workflow

The recipe we landed on while building Welcome (Figma `825:3162`). Follow it for each new screen so the rhythm becomes muscle memory.

## 1. Start clean
```
git checkout main
git pull
git checkout -b feat/<screen-name>
```
Branch names mirror the screen: `feat/welcome`, `feat/get-started`, `feat/permissions`.

## 2. Pull the design
Use the Figma MCP server. Pass the node ID for the screen:
```
get_design_context(nodeId="825:3162", fileKey="7DDh6c7tk7OKF4WiA7pEkp")
```
The output is React+Tailwind reference code — **do not paste it as-is**. It's a guide, not the answer. Adapt to the project's stack and tokens.

## 3. Decide scope of v1
Most screens have decorative illustrations or assets that aren't worth recreating layer-by-layer. Default rule:
- **In scope:** layout, copy, interactive elements, color tokens, accessibility props.
- **Deferred to a follow-up PR:** illustrative SVGs, icons, animations.

Mark deferred items with a `TODO:` comment so they don't get lost.

## 4. Update theme if needed
Before writing a hex color, font size, or spacing value inline — check `theme/`. If it doesn't exist, add it to the right file in `theme/` first, then consume it from the screen. **Never inline a design value.**

## 5. Build, iterate on phone
Save → Expo Go reloads on phone within ~1s. Tweak numbers (`marginBottom`, `width`, `borderRadius`) directly until it looks right. Don't be precious about reverting — the loop is the point.

## 6. Self-review the diff before committing
Scan your own changes in Cursor's source-control panel. Catch:
- Hardcoded values you forgot to tokenize
- Stray `console.log`s
- Comments you meant to delete
- Imports for things you ended up not using

## 7. Commit + push
```
git add <specific files>
git commit -m "feat: <screen> layout (figma <node-id>)"
git push -u origin feat/<screen-name>
```
- Use conventional-commit prefixes: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`.
- Include the Figma node ID in parens — future-you searching the log will thank you.
- Avoid `git add .` — name files explicitly.

## 8. Open the PR on GitHub
Description template:
```
## What
<one-line summary>

## Notable choices
- <decision worth remembering>
- <ditto>

## Out of scope
- <deferred to a future PR>
```

## 9. Self-review the diff on GitHub
Different mode of reading than Cursor — easier to spot mistakes when the diff is rendered as a webpage. Worth doing every time.

## 10. Merge, sync, clean up
On GitHub: **Merge pull request** → **Confirm**. Optionally delete the branch.

Locally:
```
git checkout main
git pull
git branch -d feat/<screen-name>
```

## 11. Add a learnings entry
If this PR taught you something — a new RN quirk, a layout trick, a tooling gotcha — add a one-liner to `docs/learnings.md`. Future-you reading them weekly is how you check that the work is sticking.
