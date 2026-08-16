# Oracles

Nothing on the sensor endpoint tells you whether a payload was believed. It answers `201 {"success": true}` to a correct payload, to the word `garbage`, and to a body with half of it cut off. To learn anything you need an endpoint whose answer depends on the payload, and a control arm proving it can still refuse.

Arms used throughout, each a fresh session ending in exactly one judged request:

| arm | what it sends |
| --- | --- |
| `none` | the sensor script is never fetched or run |
| `garbage` | the correct header with the word `garbage` as the body |
| `truncated` | the payload with half its body cut off |
| `wrongkey` | the payload with its substitution key moved by a constant |
| `unshuffled` | the same plaintext re-encoded without the field permutation |
| `dirty` | the payload with the automation mask set by hand |
| `plain` | what the sandbox builds from the script the edge just served |

Order matters: put the most refusable arm first, because a served request can grant the address slack for a while afterwards.

## A login POST that reads the payload

A generation 3 login endpoint, form-posted with a username that cannot exist. Six arms, one session each:

| arm | sensor post | login answer |
| --- | --- | --- |
| `none` | nothing posted | **403** Access Denied |
| `garbage` | 201, 7 bytes | **403** |
| `wrongkey` | 201, 1650 bytes | **403** |
| `unshuffled` | 201, 1656 bytes | **403** |
| `dirty` | 201, 1676 bytes | **200**, served |
| `plain` | 201, 1645 bytes | **200**, credential error page |

`wrongkey` is the arm that matters. Same length, same framing, same header, and only the decoded contents differ. The edge tells it apart from the correct payload, which means it is decrypting and reading, not shape-checking. `unshuffled` agrees: intact plaintext, wrong field order, refused.

`dirty` is the informative exception. The automation mask, the field a driven browser sets on itself, is served. This gate reads whether the payload decodes into a coherent session, not what the session admits about itself.

Two details worth keeping. The sensor collection endpoint answered `201` to every arm including `garbage`, so it carries no verdict. And `_abck` stayed unvalidated through all of it, including the arms that passed, so whatever the login endpoint reads, it is not that cookie's state.

## A tracking API that judges a header

A generation 2 property exposes a tracking API that takes the payload in an `akamai-bm-telemetry` request header rather than a cookie. It is cross-origin and carries no cookies, so the header is the only evidence the edge has. A tracking number that does not exist answers **404 when the edge believes the caller** and **403 Access Denied when it does not**, which makes it queryable without spending anything.

Four arms in one browserless session, most refusable first:

| arm | payload bytes | answer |
| --- | --- | --- |
| `garbage` | 7 | 403 refused |
| `wrongkey` | 3109 | 403 refused |
| `unshuffled` | 3102 | 403 refused |
| `plain` | 3109 | 404 served |

The whole run has no browser in it: fetch the page, read the sensor script URL out of the HTML, fetch that script, run it against a recorded environment snapshot retargeted to the live URL and the cookies the edge just set, then send what `bmak.get_telemetry()` produced. The payload check and the handshake are separable and both are met from a Node process.

## Traps

**The `404` is cached per tracking number.** A repeated number answers from cache and never reaches the edge's judgement, and the giveaway is an identical `id` in the response body. Use a random number per run. Denies are not cached; a refused request is refused even when the same number was served a moment earlier.

**A served request can buy the address slack.** On one earlier session the endpoint went from refusing garbage to answering everything, including a request with no telemetry header at all, minutes after a good payload had been served. Measure the payload with the first request a cold client makes. A `403` is meaningful whenever it appears; a `404` only means something cold.

**Post counts have to match.** On endpoints where the signal is the length of `_abck` field 2 after a post, that field grows with the number of posts the edge accepted. An arm that leaves the site's own sensor running posts a dozen times and reads a completely different length, which is not a third verdict, it is a different experiment.

**An `unshuffled` arm needs a recovered key.** If the build's permutation key was never settled, re-encoding without the permutation is a no-op, and the arm quietly posts the correct payload and reads as a pass. Report that arm as not built rather than running it.

**A username in email form can draw its own refusal.** On one login endpoint, every attempt with an `@` in the username was refused while the same code with a plain word was answered normally. That is indistinguishable from a bot verdict and cost a session to isolate.

**Endpoints stop answering under repetition.** After roughly a dozen failed submits from one address inside forty minutes, one login endpoint answered 403 to every arm, including the arm with the site's own sensor running untouched. Re-establish the baseline with a known-good arm before reading anything into a refusal.

## What a pass does and does not say

Two production endpoints, on different builds and different generations, refuse a payload with a moved key and serve the one built offline from the script they just served. That says the payload is good enough for those endpoints over a Chrome-shaped handshake.

It does not say the payload would survive a different build, a fresh address, or a property that scores rather than gates. The environment snapshot the sandbox replays is doing work that has not been measured: nothing here establishes how much of the environment can be synthesised rather than recorded from a real machine.
