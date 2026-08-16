# Driven input tells

The sensor registers pointer, key and touch listeners and turns them into event logs and counters. Anything driving a browser through the DevTools protocol produces events that differ from real ones in ways that have nothing to do with movement curves, and those differences are properties of the event object, visible to any listener.

The way to find them is to record every property of every event on a page, drive it synthetically, then type on the same page by hand and diff the two recordings. Everything below came out of that diff.

## Key events carry no code

`Input.dispatchKeyEvent` with only `text` set produces `event.code === ""` and `event.keyCode === 0`. Real typing produces `KeyH` and `72`. Both are read straight off the event by any handler, and the sensor has a `keydown` listener.

The mapping is mechanical, and it has to cover shifted characters as separate physical keys:

```js
if (/^[a-z]$/i.test(base)) return { code: `Key${upper}`, keyCode: upper.charCodeAt(0), shift };
if (/^[0-9]$/.test(base)) return { code: `Digit${base}`, keyCode: base.charCodeAt(0), shift };

const PUNCTUATION = {
  "-": ["Minus", 189], "=": ["Equal", 187], ";": ["Semicolon", 186],
  "'": ["Quote", 222], ",": ["Comma", 188], ".": ["Period", 190],
  "/": ["Slash", 191], "`": ["Backquote", 192], " ": ["Space", 32],
};
```

Typing `A` means a `ShiftLeft` keydown, then `KeyA` with `keyCode` 65 and the shift modifier, then the matching keyups. A driver that emits one event per character with no modifier state produces a keyboard nobody owns.

## Screen coordinates come from the real window

Mouse events carry `screenX` and `screenY` derived from the actual OS window position, and they ignore `Emulation.setDeviceMetricsOverride` entirely. A browser launched off screen at `--window-position=-3200,-3200` while the metrics override claims `screenX: 0` emits events whose screen coordinates disagree with the reported screen by 3200 pixels, on every single event.

The fix is arithmetic, not patching: put the window where the override says the viewport is, allowing for browser chrome height.

```js
export const WINDOW_POSITION = {
  x: METRICS.positionX,
  y: METRICS.positionY + (982 - METRICS.height),
};
```

## Client hints have to be sent with the user agent

`Emulation.setUserAgentOverride` without `userAgentMetadata` empties `navigator.userAgentData.brands` and the `sec-ch-ua` request header. No real Chrome looks like that, and the emptiness is visible both in the page and at the edge before any payload is parsed.

Reading the browser's own client hints and passing them back through the override is the only version of this that stays consistent when Chrome updates. Note that `about:blank` has no `userAgentData`, so the read has to happen on a real page.

## Pointer events

Synthetic mouse events default to a `pressure` of 0 or 1 with no intermediate values, and a `pointerType` that must be set explicitly. The dispatcher sets `pointerType: "mouse"` on every event and a `force` on press, because a pointer that reports no pressure at all while claiming to be a mouse is a shape a real device does not produce.

Movement itself is the least of it: a quadratic bezier with easing, per-step jitter and 6 to 20 ms between steps is enough for the log to look like a hand. The properties above are what separate the events regardless of the path they trace.

## Interaction shape is not always what is being read

Worth recording because it is the assumption everyone reaches for first. On a login endpoint that does refuse unbelievable sessions, a human typing by hand into a driven browser, in the same session and the same tab, got the same answer as the driver did. Deliberately robotic tab-only typing in an ordinary browser also passed. Session warmth, incognito and an hours-old cookie jar changed nothing.

So the input tells above are real, and they are worth fixing because they are cheap and visible, but on that endpoint the verdict was decided by whether the payload decoded into a coherent session, not by how the mouse moved.
