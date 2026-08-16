# Edge surface

Everything Bot Manager exposes sits on the customer origin, so identification means recognising URL shape, cookie shape and script content.

## Finding the sensor in a document

Two injection styles appear, sometimes in the same page. The documented one is `/akam/<generation>/<hash>`, with an 8 hex character hash and a matching `pixel_<hash>?a=<base64>` sibling. The live one on current configurations is an opaque multi-segment path with nothing recognisable in it.

The opaque path is found by shape, not by name: four or more segments, every segment 2 to 24 characters of `[A-Za-z0-9_-]`, no file extension, and not under `/akam/`.

```js
const looksObfuscated = (href) => {
  const path = href.startsWith("http") ? new URL(href).pathname : href;
  const segments = path.split("/").filter(Boolean);

  if (segments.length < 4) return false;
  if (/\.[a-z0-9]{2,4}$/i.test(path)) return false;
  if (path.includes("/akam/")) return false;

  return segments.every((segment) => /^[A-Za-z0-9_-]{2,24}$/.test(segment));
};
```

The other side of the check is content: the sensor's body mentions `bmak` many times, which separates it from every other script on a typical page. Both checks matter, because the same document can carry an opaque sensor path and an `/akam/13/<hash>` tag that is the pixel client, not the sensor.

**How it is detected:** nothing here detects a client, but getting it wrong is how surveys go wrong. Filtering on `/akam/` misses every current property, and identifying a build by its URL double-counts, because the path rotates while the script body stays put. See [what rotates](rotation.html).

## Telemetry on the same URL

The sensor posts to the path it was served from. `POST`, `content-type: application/json`, one key:

```json
{ "sensor_data": "2;2048;4338485;3553350;19,0,0,0,1,0;<ciphertext>" }
```

The answer is `201 {"success": true}`. Because the GET and the POST share a URL, a filter on the request URL cannot tell the script fetch from the telemetry; split them by method.

That `201` is not a verdict. Measured on a production endpoint, it comes back for a correctly built payload, for the word `garbage`, for a truncated body and for one whose key has been moved. On the same session the `_abck` cookie stays unvalidated throughout. Anything reading success from that status is reading a constant.

## Cookies

The names worth watching, and the prefix rule that catches the rest:

```js
const AKAMAI_COOKIES = ["_abck", "bm_sz", "ak_bmsc", "bm_sv", "bm_mi", "bm_so", "bm_s", "bm_lso", "sec_cpt"];
const isAkamaiCookie = (name) => AKAMAI_COOKIES.includes(name) || /^(ak_|bm_)/.test(name);
```

`_abck` is `~`-separated. Field 0 is a token, field 1 is the validation state, field 4 carries proof-of-work work items when there are any:

```
0: CB2B8A897D7AD42F22A1D62782B68E4F
1: -1                                   -1 unvalidated, 0 or 0= validated
2: YAAQYwPXF4h8bPefAQAAOYZZBRC…          state blob, re-issued per processed post
4: -1                                   proof-of-work slot
```

`bm_sz` is `<token>~<blob>~<int>~<int>`, and those two integers are not decoration: the sensor reads segment 2 as its substitution key, falling back to `8888888` when the cookie is missing or too short. The client is handed its own cipher key by the edge.

**How it is detected:** cookie issuance is not uniform across clients, and the asymmetry is itself the signal. A scripted request with browser-shaped headers and a real browser to the same URL come back with different Akamai cookie sets. Header shape does not explain it, so nothing you do at the header layer fixes it.

## Sibling hosts

Account and identity hosts are configured harder than the marketing origin. An accounts host can answer a non-browser client `403` with `Server: AkamaiGHost` while still setting `_abck` and `bm_sz`: that is the edge refusing outright, not a page with a challenge in it. Those hosts, and login POSTs in particular, are where enforcement is real. Homepages typically enforce nothing at all, which is why they are useless as a test.
