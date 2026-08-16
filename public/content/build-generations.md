# Build generations

Two generations are in production at once. They share the cipher core and almost nothing else.

| | generation 2 | generation 3 |
| --- | --- | --- |
| script size | 209,799 bytes on the build tracked | 556 KB to 600 KB |
| wrapper | named function expression with an integrity marker as its first statement | anonymous IIFE with a polyfill prologue |
| string table | runtime thunks that memoise themselves | array of two-character names at the end of the file |
| header fields | 5 posted, 4 through `get_telemetry` | 7 |
| plaintext | positional sections keyed by negative codes | one JSON object with named keys |
| permutation separator | `,` | `:` |
| shuffle key | in the header, in the clear | a constant inside the build |
| checksum | preamble field 3, `sum(charCode < 128) ^ 24` | none |

## What carries over

The substitution is identical: same 92-character alphabet, same 23-bit LCG, same `(state >> 8) & 0xffff` draw. Running it over a generation 3 body with the right key produces readable text, which is the strongest evidence the two share a cipher core even though the generation 3 source computes its constants rather than writing them as literals.

The substitution key also comes from the same place in both: `bm_sz` segment 2, with `8888888` as the fallback when the cookie is missing.

## The generation 3 shuffle key

This is the one real difference in kind. Generation 2 hands you the key in the header; generation 3 keeps it as a constant in the build's own string table, so a payload cannot be read without either recovering it or reading it out of the script.

Recovery uses an anchor rather than a brute-force comparison. The plaintext is JSON, so token 0 after unshuffling is always `{"ver"`. For each candidate key, build the permutation, look at where index 0 lands, and check only that one token before doing any work:

```js
const at = inverseIndexOfZero(order);
if (at === -1 || parts[at] !== '{"ver"') continue;
```

Survivors are then validated by parsing the result as JSON and checking `ver` against the header token. Reading the key out of the build's recorded constants beats searching for it, and the search exists as the fallback.

Two traps live here, both of which produced wrong write-ups before they were understood:

- **The key space is not 23 bits.** Candidate constants are accepted over `[2^16, 2^25)`. One build's key was 8,647,519, larger than 2^23, so a sweep of the LCG's own state space could never have found it. The model was right and the range was wrong.
- **Two keys can both produce valid JSON.** On one build, two keys in the 23-bit space produced JSON of the same length with the same 39 keys, differing only in which field landed where, 511 bytes in. Corroborating across a second payload from the same build settles it; guessing does not.

Recovered keys are cached per build fingerprint, where the fingerprint is the adapter name, the token count and a hash of the sorted tokens, so it identifies the build's permutation rather than the session.

**How it is detected:** a payload that has not actually been decoded is easy to mistake for one that has. When no key can be settled, the safe behaviour is to refuse loudly rather than treat a still-shuffled body as plaintext. A comparison run against a still-shuffled body reads as though the edge accepted an unshuffled payload, which is the opposite of what is happening.

## Identify builds by hash, not by URL

Both generations rotate, and they rotate on different axes. Sampled at fifteen-minute intervals, two generation 3 properties served three distinct script hashes each inside 31 minutes, while a generation 2 build held one hash across an afternoon and still served the same hash the next day under a completely different URL path.

So the URL is not the build and neither is it a version. A shuffle key read out of one fetch is worthless against a script fetched fifteen minutes later, and anything working against a live host has to fetch the script in the same session it uses it.
