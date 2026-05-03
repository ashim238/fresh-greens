# React + React Native basics — reference

A quick-flip reference for the syntax and patterns you'll see across this project. Each section shows the canonical form and points to where it's used in the codebase. Not a tutorial — read top-to-bottom once, then flip back to specific sections as needed.

---

## Components are functions

A component is a JavaScript function whose name starts with a capital letter and returns JSX. That's it.

```tsx
export default function Welcome() {
  return <View>...</View>;
}
```

- **Capital letter is mandatory.** Lowercase = HTML/RN primitive (`<view>` doesn't exist; `<View>` does).
- **`export default`** marks this as the file's primary export — what `import Welcome from './welcome'` picks up.
- **One return value.** A component returns *one* JSX root, even if it wraps many children. Use a fragment (`<>...</>`) when you don't want an extra wrapping View.

Used in: every screen file in `app/`.

---

## JSX

JSX is JavaScript that *looks like* HTML. It compiles down to function calls behind the scenes. Inside JSX, switch back to JavaScript with `{...}`.

```tsx
<Text style={styles.title}>Hello {name}</Text>
```

- `style={styles.title}` — `{...}` evaluates a JS expression. Here it passes the `styles.title` style object to the `style` prop.
- `Hello {name}` — `{name}` interpolates the value of the `name` variable into the text.
- Attribute names use camelCase (`accessibilityLabel`, not `accessibility-label`).
- `class` becomes `className` (in RN, `style` instead).
- Self-closing tags require the slash: `<View />`, not `<View>`.

Used in: every line of JSX in this project.

---

## Props

Props are how parents pass data to children. Looks like HTML attributes, behaves like function arguments.

```tsx
function Greeting({ name }) {
  return <Text>Hello {name}</Text>;
}

// Used as:
<Greeting name="Myles" />
```

- **`{ name }`** in the function signature is destructuring — pulls `name` out of the props object.
- **TypeScript version** types the prop:
  ```tsx
  function Greeting({ name }: { name: string }) { ... }
  ```
- Pass anything: strings, numbers, objects, functions, other JSX.

Built-in props worth knowing in RN:
- **`style`** — accepts a style object or an array of style objects (`[base, modifier]`).
- **`onPress`** — fires when tapped. Expects a function.
- **`accessibilityRole`, `accessibilityLabel`** — for VoiceOver. Always set on interactive elements.

---

## Children

Whatever's between a component's opening and closing tags is `children` — a special prop that contains the nested JSX.

```tsx
<Pressable>
  <Text>Get started</Text>
</Pressable>
```

`<Text>` is the `children` of `<Pressable>`. You don't usually destructure `children` explicitly in screens — you just nest JSX as you would HTML.

---

## State (`useState`)

When something can change over time, hold it in state. State changes trigger re-renders.

```tsx
import { useState } from 'react';

function Welcome() {
  const [agreed, setAgreed] = useState(false);

  return (
    <Pressable onPress={() => setAgreed(!agreed)}>
      <Text>{agreed ? 'Agreed' : 'Tap to agree'}</Text>
    </Pressable>
  );
}
```

- **`useState(initialValue)`** returns a tuple: `[currentValue, setterFunction]`. Naming convention: `value` + `setValue`.
- **Calling the setter** schedules a re-render with the new value. Never mutate state directly (`agreed = true` does nothing useful).
- **Hooks must be called at the top** of the component, never inside conditionals or loops.

Not yet used in this project — first place will likely be the Welcome checkbox or sign-up forms.

---

## Hooks (the rules)

Hooks are functions whose name starts with `use` and that "hook into" React's internals — state, lifecycle, context, navigation.

Rules:
1. **Call at the top of a component.** Never inside `if`, `for`, or after an early `return`.
2. **Only call from React components or other hooks.** Never from regular helpers.
3. **The names are conventional.** `useState`, `useEffect`, `useRouter`, `useMemo`. If the function starts with `use`, you're calling a hook and the rules apply.

Used in this project: `useRouter()` in `app/index.tsx` (for `router.push()`).

---

## Event handlers

Pass a *function* (not a function call) to event props.

```tsx
// ✓ Pass the function reference
<Pressable onPress={handleTap}>

// ✓ Wrap in arrow function when you need to pass arguments
<Pressable onPress={() => router.push('/get-started')}>

// ✗ This calls handleTap immediately at render time — almost always wrong
<Pressable onPress={handleTap()}>
```

The arrow form `() => expr` is shorthand for `function() { return expr }`. It defines a brand-new function that runs `expr` when called.

See full breakdown in `learnings.md` under feat/get-started.

---

## Conditional rendering

Use ternaries for "this or that," `&&` for "this or nothing."

```tsx
// Either-or
{isLoggedIn ? <Profile /> : <Login />}

// Show only when truthy (a "hide" pattern)
{hasError && <ErrorBanner />}

// Hide pattern — note: don't use `condition && 0` or numbers; React may render the 0
{items.length > 0 && <List items={items} />}
```

Inside JSX, `{}` switches to JS. The expression's value gets rendered (or ignored if `false`/`null`/`undefined`).

---

## Lists

Render arrays with `.map()`. Each child needs a unique `key`.

```tsx
{items.map((item) => (
  <Text key={item.id}>{item.name}</Text>
))}
```

- **`key`** lets React track which item is which when the list changes. Use a stable unique ID (database ID, not the array index unless the list never reorders).
- The `.map()` returns an array of JSX, which React renders as a flat sequence.

---

## Styles (StyleSheet API in RN)

Define styles outside the component, reference by name inside.

```tsx
import { StyleSheet, View } from 'react-native';

function Card() {
  return <View style={styles.card} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
  },
});
```

- **`StyleSheet.create(...)`** — wraps a plain object. Mostly for type-checking + (minor) perf optimization in some RN versions.
- **Numbers, no units.** `padding: 16` not `padding: '16px'`. Numbers are density-independent points.
- **camelCase property names.** `backgroundColor`, `borderRadius`, `paddingHorizontal`.
- **Combine multiple styles** with an array: `style={[styles.button, styles.buttonPrimary]}`. Later styles override earlier ones (modifier pattern).

---

## Layout — flexbox

RN's only layout system. Defaults differ from web:
- `flexDirection: 'column'` is the default (web defaults to `row`).
- All Views are flex containers by default.

Key props on the *container* (parent):
- **`flexDirection`** — `'column'` (default) or `'row'`.
- **`justifyContent`** — alignment along the *main* axis (vertical for column, horizontal for row). Values: `'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly'`.
- **`alignItems`** — alignment along the *cross* axis (horizontal for column, vertical for row). Values: `'stretch' (default) | 'flex-start' | 'center' | 'flex-end' | 'baseline'`.
- **`gap`** — space between children. Use this instead of margins on each child when possible.

Key props on the *item* (child):
- **`flex: 1`** — claim leftover space. Multiple `flex: 1` children share leftover space equally.
- **`alignSelf`** — override the parent's `alignItems` for this one child.

The `default stretch + alignSelf overrides on exceptions` pattern is more robust than flipping the parent's `alignItems` and compensating everywhere.

---

## Absolute positioning

Take an element out of normal layout flow and place it relative to its closest *positioned* ancestor.

```tsx
<View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 80 }} />
```

Common patterns:
- **Pin to bottom:** `position: 'absolute', bottom: 0, left: 0, right: 0`.
- **Center an element:** `position: 'absolute', top: '50%', left: '50%'`, then offset back by half its own size with `marginTop` / `marginLeft` (or `transform: [{ translateX: -<half> }, { translateY: -<half> }]`).

JSX source order = paint order for absolute siblings. Later in JSX = renders on top.

---

## Transform

Move/rotate/scale an element *visually* without affecting layout flow. Layout still treats the element as if it were in its original position.

```tsx
style={{
  transform: [
    { translateX: -20 },  // negative = left
    { translateY: -50 },  // negative = up
    { rotate: '17deg' },
  ],
}}
```

Why prefer transform over `marginLeft` for fine-tuning: margin pushes neighbors around; transform doesn't.

Coordinate convention: `+y` is *down*, `-y` is *up* (standard screen coordinates, opposite of physics).

---

## File-based routing (expo-router)

A file at `app/index.tsx` is the `/` route. A file at `app/get-started.tsx` is the `/get-started` route. Folders become nested routes. No manual route registration.

```tsx
import { useRouter } from 'expo-router';

const router = useRouter();
router.push('/get-started');  // navigate
router.back();                // go back
```

Layouts live in `app/_layout.tsx` (or `app/<folder>/_layout.tsx` for nested layouts) — the underscore prefix means "wrap, don't route."

---

## TypeScript essentials in this project

- **Function signatures** can declare parameter types: `function greet(name: string)`.
- **`as const`** narrows an object's inferred type from `string` to the exact literal. Combined with `keyof typeof`, that's how we get a typed union of valid color names in `theme/colors.ts`.
- **Import types with `import type`** if you ever need to (`import type { ColorToken } from '../theme/colors'`).
- **Hover any symbol in Cursor** to see its inferred type. The fastest way to learn TS is to read the inferences.

---

## Where to look in this project

- **A complete screen example:** `app/index.tsx` (Welcome).
- **Navigation:** `app/index.tsx`'s `useRouter()` + `router.push()`.
- **Image assets:** `app/index.tsx`'s `<Image source={require(...)} />`.
- **Icon fonts:** `app/get-started.tsx`'s `<Ionicons />`.
- **Nested layout structures:** `app/permissions.tsx`'s nested wrapper Views mirroring Figma groups.
- **Theme tokens:** `theme/colors.ts` — `as const` + `keyof typeof` for typed colors.
