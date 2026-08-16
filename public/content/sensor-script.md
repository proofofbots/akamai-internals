# The sensor script

Roughly 210 KB on one line for the generation 2 build tracked here, 556 KB to 600 KB for generation 3 builds. The whole thing is one self-calling wrapper.

```js
(function qRgxPcXAER(){MT();0xcff0cc1,2656862855;M2T();f2T();…}());
```

## Obfuscation shape

Every identifier is two or three characters, and the top level of one build parses to 1,453 names. Control flow is flattened: most work happens inside `while (state != K) switch (state) { case A: … }` dispatchers whose case labels are computed at load from arithmetic over other mangled variables. Most named functions are trampolines into one of those dispatchers.

```js
function xY(){ return hH.apply(this, [0x3f, arguments]); }
```

Two structures carry the meaning. One is a global-object handle resolved once at startup and then indexed with decoded strings, so every global the script touches goes through it. The other is a table of string thunks: call sites look like `TT.ZO.apply(null, [sJ, Xm, JJ])`, the arguments select the string, and the thunk memoises itself on first call by overwriting its own slot.

The raw strings live in around a dozen escape-heavy arrays. They decode lazily and only on demand, so a static pass over the arrays yields nothing readable, and extraction has to be dynamic.

## The integrity signature

The first statement of the wrapper is a bare expression, `0xcff0cc1,2656862855;`. It is not dead code, it is the signature. The check takes the script's own source through `Function.prototype.toString`, cuts the marker out of it, appends `typeof window["<wrapper name>"]` (which is `"undefined"`, because a named function expression creates no global), hashes that, and subtracts the hash from the stored constant.

The hash is MurmurHash3 x86 32-bit with a per-build seed, over UTF-16 code units, skipping `\n`, `\r` and space:

```js
for (let index = 0; index < text.length; index += 1) {
  const code = text.charCodeAt(index);
  if (code === 10 || code === 13 || code === 32) continue;
  /* standard murmur3 body, 0xcc9e2d51 / 0x1b873593 */
}
```

Skipping whitespace means reformatting the script does not break the signature. Changing one non-whitespace character does.

The result is not a boolean. It is folded into the string decoder's index arithmetic, so a wrong value does not raise: it silently decodes every string to the wrong value, the script keeps running, and it dies much later somewhere unrelated. That delay is the whole point of the design.

The expected result is also not zero. On the build tracked, the stored constant is 2,656,862,855, the hash of its own body is 2,656,862,384, and the difference the decoder expects is **471**. The check is not "hash must match", it is "hash must be off by exactly the amount the decoder expects".

Because the marker is excised before hashing, the constant can be recomputed for an edited script:

```
delta  = stored - murmur(original body)
stored = murmur(edited body) + delta
```

Re-signing after an edit reproduces the same delta, which is one of the offline regression checks. Locating the pieces is by shape, not by name: the named function expression, the `0x<hex>,<decimal>;` marker, a function body containing `0xcc9e2d51`, and the literal seed passed to it.

**How it is detected:** any patch that changes a non-whitespace byte without re-signing corrupts every decoded string. Patching the string table without fixing the signature yields strings like `"8P/6S"` where `"prototype"` belongs, and the run fails deep inside with `Cannot set properties of undefined`.

The check also runs continuously. On a clean load, `Function.prototype.toString` is called 34 times, every one of them on the wrapper.

## Do not fold the strings before tracing

Replacing each decoder call with the string it returned produces a much more readable script that does not work. Both generations decode with a stateful decoder, so removing a call changes what later calls return. On one build the folded script runs without throwing and silently stops posting; on another it throws outright. Instrument the script exactly as served and read the decoder output from the recording instead.

## The runtime surface

For all of the obfuscation, a small object is published on `window`:

```
bmak.firstLoad      boolean
bmak.form_submit    function
bmak.get_telemetry  function
bmak.listFunctions  object
bmak.applyFunc      function
bmak.startTs        number, ms epoch of script start
```

`window._sdTrace` holds a trace string, `<init/>` on a clean load. If the payload builder throws, the exception stack goes into that trace and into the payload as its own section, so a payload carrying it is a payload from a client that broke.

`listFunctions` is the registry the URL config bits drive:

```
_setFsp  _setBm  _setAu  _setPowState  _setIpr  _setAkid  _fetchParams
```

`get_telemetry()` returns `a=<token>&&&e=<base64>` on builds that post by themselves. On builds that do not, it returns the full telemetry header including the payload, around 4.5 KB to 4.9 KB, which is what the page's own script sends in a request header.

**How it is detected:** these two build shapes need different harnesses. A run that waits for a `sensor_data` POST will wait forever on a build that only exposes `get_telemetry`, and conclude wrongly that the script did not run. Both shapes were observed on the same brand, one per host.
