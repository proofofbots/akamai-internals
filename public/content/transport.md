# Transport fingerprints

Akamai grades the connection before it grades the payload. A perfect `sensor_data` over a stock Node socket is a bot with a good payload, and the decision was already made.

The numbers below were measured by taking the ClientHello off the wire on a local TLS server, completing the handshake, answering the HTTP/2 request and reporting the fingerprints. Chrome 151 headless and Node's `http2` client, against the same server:

| | Chrome | Node |
| --- | --- | --- |
| cipher suites | 16, one GREASE | 52, no GREASE |
| extensions | 18, two GREASE | 12, no GREASE |
| ALPN offered | `h2`, `http/1.1` | `h2` |
| JA3 | `75a6d12708aa584ed06f0e4da0c1fcf2` | `983846581fdb62fafdb21d2282592c57` |
| JA4 | `t13d1516h2_8daaf6152771_806a8c22fdea` | `t13d5212h2_b262b3658495_8e6e362c5eac` |
| HTTP/2 | `1:65536;2:0;4:6291456;6:262144\|15663105\|1:1:0:256,3:1:0:220\|m,a,s,p` | `\|00\|0\|p,m,a,s` |

Every column differs, and each difference classifies on its own.

- **Cipher count.** 16 against 52. Node offers the OpenSSL default list; Chrome offers a short fixed list in a fixed order.
- **GREASE.** Chrome inserts one GREASE cipher and two GREASE extensions, at positions that move per connection. Node inserts none. Absence of GREASE is a single-bit tell.
- **HTTP/2 SETTINGS.** Chrome sends `HEADER_TABLE_SIZE=65536`, `ENABLE_PUSH=0`, `INITIAL_WINDOW_SIZE=6291456`, `MAX_HEADER_LIST_SIZE=262144`, in that order, with no `MAX_CONCURRENT_STREAMS`, then a connection `WINDOW_UPDATE` of 15,663,105. Node sends an empty SETTINGS frame and no WINDOW_UPDATE at all.
- **Priority.** Chrome attaches priority information to its request headers. Node sends none.
- **Pseudo-header order.** Chrome sends `:method, :authority, :scheme, :path`. Node sends `:path, :method, :authority, :scheme`. Akamai's own published HTTP/2 fingerprint format is exactly `SETTINGS|WINDOW_UPDATE|PRIORITY|pseudo-header order`, so this is graded explicitly rather than incidentally.

## JA3 is not stable for Chrome, JA4 is

The Chrome JA3 above differs from the value the same browser produced on the same machine a day earlier, while the JA4 cipher hash `8daaf6152771` is unchanged and is the value Chrome is known to produce.

GREASE values and extension order are randomised per connection by design, so a JA3 taken raw is a moving target unless GREASE is stripped first. Treat a JA3 mismatch across two of your own runs as normal, and prefer JA4 or an explicit field-by-field comparison when you need something to hold still.

## What closes the gap

Reproducing the payload is the smaller half. A client posting `sensor_data` without reproducing the handshake needs one of:

- a real browser as the transport, which is the only way to attribute a failure to the payload rather than the socket;
- a TLS stack with per-field control over the ClientHello and an HTTP/2 implementation with control over SETTINGS order, WINDOW_UPDATE and pseudo-header order;
- a proxy that rewrites the handshake underneath an ordinary HTTP client.

The second is what the browserless client here uses, wrapping a Chrome-profile TLS library with extension order randomisation left on:

```js
const session = new Session({
  clientIdentifier: ClientIdentifier[profile],
  timeout,
  insecureSkipVerify: false,
  randomTlsExtensionOrder: true,
});
```

**How it is detected:** measured directly against a production API that judges the payload in a request header, plain Node `fetch` is refused with a header the edge had accepted from a browser moments earlier, while the same header over the impersonating stack is served. Nothing else about the request changed. Header order and casing sit on top of all this and are the part that gets attention first and buys the least.

## Caveats

These are one Chrome build on macOS, first request on a fresh connection. Chrome's later requests on the same connection carry different priority information, so a client compared mid-connection will not match a first-request reference.
