# Akamai Bot Manager internals

Akamai Bot Manager runs at the CDN edge. There is no third-party origin: the sensor script, the telemetry sink, the pixel challenge and any interstitial come from the customer's own hostname, injected or proxied by the edge. Identifying it on a page is a matter of URL shape, cookie shape and script content, never a vendor domain.

These pages describe what the client does and how the edge answers, measured against live builds. Numbers come from decoded payloads, instrumented runs and requests sent to production endpoints. Where a claim is inference rather than measurement, it says so.

Hostnames, cookie values, API keys and script paths are redacted. Formats, field names, constants and algorithms are not: they are the useful part, and they rotate per build anyway.

## What runs on the page

| piece | what it is |
| --- | --- |
| sensor | a large obfuscated script that instruments the page and produces `sensor_data`, either posting it itself or handing it to the page through `bmak.get_telemetry()` |
| pixel challenge | a small separate client seeded by an inline `bazadebezolkohpepadr` integer, posting an unencrypted form body |
| `sec-cpt` | a proof-of-work interstitial, configured through the sensor rather than as its own client |

A protected document usually carries several tags at once:

```html
<script src="/GcvTpQmXd/PWnq4Rt/8k/<config-segment>/Zr91ke2sqA/LxNU/Qj4PH2sB"></script>
<script>bazadebezolkohpepadr="1320943881"</script>
<script src="/akam/13/4ebc0144"></script>
<script src="/akam/13/pixel_4ebc0144?a=<base64>"></script>
```

The opaque multi-segment path is the live sensor on current configurations. The `/akam/<generation>/<hash>` pair is the older delivery style; on several properties it is the pixel client only, and on others it is inert.

## The verdict is layered

The edge does not make one decision, it makes four, in order:

- **Connection.** TLS ClientHello and the HTTP/2 preface are graded before any JavaScript runs. Node's stock TLS stack is separable from Chrome's on cipher count, GREASE and SETTINGS alone. See [transport fingerprints](transport.html).
- **Document.** Cookie issuance already differs by client before a script has executed.
- **Payload.** The edge decrypts `sensor_data`, applies this build's field permutation and reads the contents. A payload with a moved substitution key, or one re-encoded without the permutation, is refused where the same bytes correctly built are served. See [oracles](oracles.html).
- **Reputation and state.** Some endpoints cache, and some grant an address slack after they have served it, which makes naive A/B measurement lie. See [what rotates](rotation.html).

## Reading order

Read [edge surface](edge-surface.html) to know what you are looking at, then [sensor_data format](payload-format.html) for how a payload is framed and encrypted, then [oracles](oracles.html) for how to tell whether anything you built was actually read. If the question is "what does this report about my automation", go straight to [automation markers](automation-markers.html).

## Scope

This is client-side observation of a defence: what the script reads, how it packages it, and what the edge does with the result. It is written for people building detection, testing properties they own, or trying to understand what a bot-management verdict is made of.
