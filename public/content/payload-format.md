# sensor_data format

A `sensor_data` string is a header of plain fields followed by ciphertext. Both keys travel in the clear, so a captured payload decrypts with nothing but itself.

## The frames

Generation 2, posted:

```
2 ; <bitmask> ; <substitution key> ; <shuffle key> ; <six timings> ; <ciphertext>
```

Generation 2, the shape `bmak.get_telemetry()` returns, with no bitmask field:

```
2 ; <substitution key> ; <shuffle key> ; <six timings> ; <ciphertext>
```

Generation 3, seven header fields:

```
3 ; <leading> ; <leading> ; <bitmask> ; <substitution key> ; <base64 token> ; <six timings> ; <ciphertext>
```

Two things bite here. The ciphertext contains `;`, so a naive split gives a field count that changes between payloads: take the header fields and re-join the rest. And the same build frames differently depending on the channel, so a parser that assumes a fixed header length is wrong for one of the two v2 shapes. Detection is by testing the fields, not by counting them:

```js
const full =
  parts.length > 5 &&
  NUMERIC.test(parts[1]) && NUMERIC.test(parts[2]) && NUMERIC.test(parts[3]) &&
  TIMINGS.test(parts[4]);
```

The generation 3 token in header field 5 also appears inside the plaintext as `ver`, which is a cheap self-check that the body was decoded correctly.

## The cipher

Two keyed passes, both driven by the same 23-bit LCG:

```js
const step = (state) => {
  let next = state * 65793;
  next &= 0xffffffff;
  next += 4282663;
  next &= 0x7fffff;
  return next;
};

const draw = (state) => (state >> 8) & 0xffff;
```

**Substitution.** The alphabet is codes 32 to 126 excluding `"` (34), `'` (39) and `\` (92), 92 characters. Every character in the alphabet is rotated forward by `draw % 92`, stepping the LCG once per input character; anything outside the alphabet passes through. Key is the substitution key from the header, which the sensor read out of `bm_sz`.

Dropping `"` and `\` keeps the result safe inside a JSON string. `,` and `;` stay inside the alphabet, which is why framing has to be undone from the header outwards rather than by splitting.

**Permutation.** The body is split on a separator, then for each index in turn two positions are drawn and swapped:

```js
const swaps = (count, key) => {
  const pairs = [];
  let state = key;

  for (let index = 0; index < count; index += 1) {
    const first = draw(state) % count;
    state = step(state);
    const second = draw(state) % count;
    state = step(state);
    pairs.push([first, second]);
  }

  return pairs;
};
```

The separator differs by generation: `,` for v2, `:` for v3. Undoing it is the same swap list replayed backwards.

Decoding order is substitution first, which restores the real separators, then the permutation.

**How it is detected:** the edge applies the permutation with the build's own key and notices when the result is not what it expects. Measured against two production endpoints today, a payload re-encoded without the permutation, with everything else identical, is refused where the correct one is served. Same for a payload whose substitution key was moved by a constant. The edge is decrypting and reading, not shape-checking. See [oracles](oracles.html).

## Generation 2 plaintext

Sections joined by a per-post random separator that itself contains commas. After a four-entry preamble the rest is strictly `<code>` then `<data>`, where codes are the negative integers the string table also carries.

```
2 <sep> 2 <sep> 7a74G7m23Vrp0o5c961547nSUuCfDMvBzj2S2zmHgqNw== <sep> 168332 <sep> -100 <sep> …
```

Nothing transmits the separator. The plaintext starts with `2`, the separator, `2`, so the text between the first two `2`s is the separator, and any separator that does not collide with the body works. The generator that builds one draws 2 to 4 groups of 2 to 4 characters and retries on collision, from an alphabet that deliberately contains no `2`:

```js
const SEPARATOR_ALPHABET = "0134567890134567890134567890abcdefghijklmnopqrstuvwxyz";
```

Preamble entry 3 is a checksum over the joined body:

```js
const checksum = (text) => {
  let total = 0;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code < 128) total += code;
  }
  return total;
};

const stated = checksum(body) ^ 24;
```

## Generation 3 plaintext

One JSON object with named keys, `ver` first, and two lists of single-key objects, `din` and `mst`, that carry most of the device and counter fields. Validation is structural: parse it, check `ver` is a string and matches the header token, check `din` and `mst` are lists of one-key objects. That is what makes an unshuffled or mis-keyed decode obvious to a reader as well as to the edge.

## The preamble token

The 46-character value in the v2 preamble looks like a secret and is not one. It is two build constants and the current hour bucket, with only the digits rotated:

```js
const dpt = (text, key) => { /* rotate characters 48..57 by key charCode, letters untouched */ };

const key = dpt("0a46G5m17Vrp4o4c", "afSbep8yjnZUjq3aL010jO15Sawj2VZfdYK8uY90uxq").slice(0, 16);
const token = key + dpt(String(Math.floor(Date.now() / 3600000)), key) + "nSUuCfDMvBzj2S2zmHgqNw==";
```

For the v2 build studied, `key` is always `7a74G7m23Vrp0o5c`. Reproducing a captured payload's token from its timestamp alone gives back the same 46 characters, which is checked as a regression on every pinned capture.

**How it is detected:** it is an hour bucket, so a replayed payload from a previous hour carries a token that no longer matches the clock. That is one of several coarse time buckets in the payload; [what rotates](rotation.html) lists the others.
