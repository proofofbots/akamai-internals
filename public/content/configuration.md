# Script URL configuration

The sensor configures itself from the path it was served from. No inline call, no JSON blob: the settings are one bit per character pair of one path segment, readable without executing anything.

## The encoding

Take `src`, split on `/`, and use the fourth segment from the end. It is used only if its length is even. Each pair of characters is one bit: `1` if either character is in `aeiouy13579`, `0` otherwise.

```js
const MARK = "aeiouy13579";

const bitsFromSegment = (segment) => {
  const lower = String(segment).toLowerCase();
  let bits = "";

  for (let index = 0; index < lower.length; index += 2) {
    const first = MARK.indexOf(lower.charAt(index)) >= 0;
    const second = MARK.indexOf(lower.charAt(index + 1)) >= 0;
    bits += first || second ? "1" : "0";
  }

  return bits;
};
```

Worked through on a segment served today:

```
segment   a Y  O G  D f  h Y  c E  i O  D r  X O
bit        1    1    0    1    1    1    0    1     ->  11011101
```

A segment of three bits or fewer is not applied at all.

## What the bits do

| bit | setter | effect |
| --- | --- | --- |
| 0 | `_setFsp` | rewrite the post URL to `https` |
| 1 | `_setBm` | post to `/_bm/_data` instead of the script path |
| 2 | `_setPowState` | run the proof-of-work challenge |
| 3 | `_setIpr` | carry the IP reputation signal |
| 4 | `_setAkid` | carry the Akamai id, only read when there are more than four bits |

Bit 1 does not mean what it looks like. After the bits are applied the sensor calls `_fetchParams(false)` and then `_setAu(<its own src>)`, which overwrites the `_setBm` choice, so a property with bit 1 set still posts to the script path. `_setAu` runs last and wins.

## Measured

Six properties sampled in one sweep, all serving an obfuscated sensor path:

| build | segment | bits | proof of work |
| --- | --- | --- | --- |
| v2 logistics portal | `aYOGDfhYcEiODrXO` | `11011101` | off |
| v3 accounting SaaS login | `9mJYbtOiuDD3mp9i` | `11011101` | off |
| v3 airline | `p1V1N89wJ7YOrSYOhu` | `110111011` | off |
| v3 retail | `cOGuQm5L9p9mpSOi` | `11011101` | off |
| v3 airline (second) | `Ycf9GhD9Y5uGzJ` | `1101110` | off |

Every one of them decodes to `forceSecure`, `botManager`, `ipReputation` and `akid` on, proof of work off. That has held across every host sampled with a real obfuscated path, which is why no `sec-cpt` challenge has been seen from an ordinary page load.

The same origin can also differ per path: on one property the homepage and login page shared a segment while the tracking path served a different one, differing in the `botManager` bit, with identical script bytes on all three.

## The host-derived case

When a site serves the sensor from `/akam/13/<hash>`, the fourth-from-last segment is the hostname, so the bits are an artefact of the URL shape rather than a setting. The parser flags that case rather than reporting flags:

```js
return { segment, fromHost: segment === host };
```

Two properties in the same sweep had rotated to exactly that state: the discovery pass found only an `/akam/13/<hash>` client of 26.7 KB, where a day earlier the same entry pages had named obfuscated sensors of 568 KB and 575 KB. Treat a missing obfuscated path as a configuration that changed, not as a property without Bot Manager.
