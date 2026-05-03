# Learnings log

Running notes on things that bit me, surprised me, or clicked. One line per entry, newest at the top. Re-read every couple weeks to check the work is sticking.

---

## feat/get-started (2026-05-02)

- **`onPress={handler()}` runs at render time and is almost always wrong.** `onPress` wants a function, not the result of calling one. Three forms: `onPress={fn}` if no args, `onPress={() => fn(arg)}` if args, never `onPress={fn()}`.
- **Arrow function `() => expr` is shorthand for `function() { return expr }`.** Defines an anonymous function that runs `expr` when called.
- **`useRouter()` is a hook — call it at the top of the component**, not inside conditionals or loops. Hooks always start with `use`.
- **`router.push('/path')` matches a file at `app/path.tsx`.** That's the file-based routing magic — no manual route registration.
- **Pattern reuse from screen to screen is a trap.** Welcome had a curved hill; I copied the same View+borderRadius onto Get Started without checking the design — but Get Started's divider is *flat*. Look at the design first, name the shape, then decide whether to reuse. Anti-slop rule "match existing patterns" only applies when the new screen actually wants the existing pattern.
- **Name styles by what they are, not where they came from.** `hill` implies a curve; `ground` describes a flat lower section. Future-you reading the file shouldn't have to guess.

---

## feat/welcome (2026-05-01)

- **Git commits live in `.git/` locally — they're real before you push.** GitHub is just a hosted copy. `git push` is backup + share, not "make the commit count."
- **`git checkout -b` = create a branch *and* switch to it.** `-b` is `--branch`, the create flag.
- **`-u` on `git push` sets upstream tracking.** First push only; later pushes are just `git push`.
- **`as const` on a TS object literal** narrows the inferred types from `string` → exact literals. Combined with `keyof typeof`, that's how you get a union type of valid color names.
- **In RN, `borderRadius` clamps to half the element's width.** A 240 radius on a 390-wide View becomes 195 on each top corner — and two 195-radius quarter-circles meeting at the top-center give a tombstone dome, not a hill. Fix: extend the element past the screen edges + much larger radius. Only the gentle middle of the arc shows.
- **RN layout is bottom-anchored when actions are pinned to the bottom.** To move a sibling *up*, increase the gap *below* it (its `marginBottom`), not the space above it. Backwards from web instinct.
- **`StyleSheet` has no units.** Numbers are density-independent pixels; same physical size on iPhone SE and Pro Max.
- **`fontWeight` in RN is a string, not a number.** `'700'`, not `700`. Trips everyone up once.
- **`Text` can't sit directly inside a `View` as a string.** Always wrap in `<Text>`. Different from HTML.
- **Built-in `SafeAreaView` is the simpler version.** `react-native-safe-area-context` is the more capable replacement we'll swap in when the built-in misbehaves (landscape, side notches, custom inset positioning).
