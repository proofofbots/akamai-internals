# The pixel challenge

A second, entirely separate client. It shares nothing with the sensor: different script, different obfuscation, different endpoint, and a payload that is not encrypted at all.

## How it is wired

The document carries an inline seed and two script tags:

```html
<script type="text/javascript">bazadebezolkohpepadr="1320943881"</script>
<script type="text/javascript" src="/akam/13/4ebc0144"></script>
<script type="text/javascript" src="/akam/13/pixel_4ebc0144?a=<base64>"></script>
```

`/akam/13/<hash>` is the pixel client. `pixel_<hash>` is where it posts. The hash is derived from the seed:

```js
const hash = (77 ^ bazadebezolkohpepadr).toString(16);
// 1320943881 ^ 77 === 0x4ebc0144
```

The script recomputes the POST path itself rather than trusting the tag, so the seed is the only thing that has to arrive intact. The `a` parameter decodes from base64 to `t=<40 hex>&js=off`, where `t` is the token the client posts back.

Two properties sampled today served this client and nothing else at `/akam/13/<hash>`, at 26,699 and 26,711 bytes, having named full obfuscated sensors a day earlier. The pixel client is not only a legacy path.

## The script

Around 27 KB, obfuscated with a plain hex-escaped string table (`var _ = ["\x2c\x20", …]`, roughly 340 entries) referenced as `_[n]`. No integrity check, no control-flow flattening, no runtime decoding. Inlining the table statically is enough to read it; there is no need to run it.

Three 32-hex constants are baked in per build, one of which is posted as `u`. The hash primitive is stock SHA-1, recognisable from its initial state:

```js
1518500249, 1859775393, 2400959708, 3395469782
```

**How it is detected:** this client is the cheap one to study and the cheap one to fake, which is why it carries less weight than the sensor. It is worth reading precisely because it states in plaintext what the sensor sends encrypted.

## The payload

`POST /akam/13/pixel_<hash>`, `application/x-www-form-urlencoded`, no encryption and no encoding beyond form escaping.

| field | contents |
| --- | --- |
| `ap` | `true` |
| `bt` | `navigator.getBattery()` result as JSON |
| `fonts`, `fh` | font probe, `null` when it does not run |
| `timing` | stage timings `1`…`6`, `main`, `compute`, `send`, plus a `profile` object of per-probe status codes |
| `bp` | ten signed 32-bit integers |
| `sr` | `inner`, `outer`, `screen`, `pageOffset`, `avail`, `size`, `client`, `colorDepth`, `pixelDepth` |
| `dp` | presence map for 25 DOM features, from `XDomainRequest` to `contextMenu` |
| `lt` | `Date.now()` plus a small integer |
| `ps` | `localStorage` and `sessionStorage` writability |
| `cv` | SHA-1 of a canvas dataURL |
| `fp`, `sp`, `ieps`, `av` | booleans |
| `br` | browser name |
| `z` | `{"a":<int>,"b":1,"c":1}` |
| `jsv` | `1.5`, the highest `language="JavaScript1.x"` a script tag accepts |
| `nav` | a full `navigator` dump including `plugins`, `webdriver`, `languages`, `oscpu`, `buildID` |
| `crc` | `window.chrome` serialised |
| `t` | SHA-1 of the seed |
| `u` | the build's first baked constant |
| `nap` | a 20-digit string, one digit per permission probe |

## The canvas probe

The well-known one, unchanged:

```js
ctx.fillStyle = "rgba(255,153,153, 0.5)";
ctx.font = "18pt Tahoma";
ctx.fillText("Soft Ruddy Foothold 2", 2, 2);
// three coloured rectangles
ctx.fillText("!H71JCaj)]# 1@#", 4, 8);
sha1(canvas.toDataURL());
```

**How it is detected:** the output is a single hash, so any per-load noise injection produces a value that never repeats. A real machine returns the same hash on every load and a stable one across sessions. Randomising canvas output is more visible here than leaving it alone.

## The permission probe

`nap` comes from querying the Permissions API for a list of names and recording each outcome as one digit, with `4` reserved for the case where the browser answers `is not a valid enum value of type PermissionName`.

**How it is detected:** the invalid-enum digit is the interesting one. It records which names the browser refuses to recognise, which is a version and engine tell that a patched `permissions.query` usually gets wrong by answering everything successfully.

## The retry loop

`compute()` fills the payload and the caller checks `exitEarly()`, which is `X.z.a != v`: the `z` probe has to agree with the seed. If it does not, and less than 500 ms has passed, the script recomputes `z` under a new key (`z1`, `z2`, …) every 100 ms. Whatever it has after 500 ms is posted, and the number of retries is visible in the `profile` object, so a client that struggled says so in its own payload.
