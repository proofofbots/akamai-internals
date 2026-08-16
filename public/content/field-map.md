# Where fields come from

Every field of a decoded payload can be traced back to the browser property, literal or counter that produced it, by instrumenting the script as served and walking each field's expression backwards through what the run actually computed.

## Generation 3, by name

The plaintext is one JSON object. Device facts live under `din`, counters and timing under `mst`, with a handful of top-level fields.

| field | source |
| --- | --- |
| `ver` | build constant, the same base64 the header carries |
| `din.ua`, `din.ucs` | `navigator.userAgent`, and a length or checksum over it |
| `din.nal`, `din.nap`, `din.nps` | `navigator.language`, `product`, `productSub` |
| `din.npl` | `navigator.plugins.length` |
| `din.wiw`, `din.wih`, `din.wow` | `window.innerWidth`, `innerHeight`, `outerWidth` |
| `din.swi`, `din.she`, `din.asw`, `din.ash` | the four `screen` dimensions |
| `din.wdr` | `window.webdriver` |
| `din.pha` | `window._phantom` |
| `din.dau` | `window.domAutomation` |
| `din.adp` | the marker list, `cpen`, `i1`, `dm`, `cwen`, `non`, `opc`, `fc`, `sc`, `wrc`, `isc`, `vib`, `bat`, `x11`, `x12` |
| `din.xag` | a 14-bit capability mask over `DeviceOrientationEvent`, `DeviceMotionEvent`, `TouchEvent`, `PointerEvent`, `window.chrome` and window dimensions |
| `din.hz1`, `din.hal` | derived from `bmak.startTs` |
| `din.ran` | a `Math.random` sample |
| `fpt`, `fpc` | the feature and timezone string, and a murmur over it |
| `sde` | probes including `$cdc_asdjflasutopfhvcZLmcfl_` on `window` and `document` |
| `eem` | which event constructors exist |
| `ajr` | the derived block, see below |
| `pur` | `document.URL` |
| `ffl` | a path segment of the sensor script URL, read from `document.currentScript` |
| `mst.delt`, `mst.ssts`, `mst.sts`, `mst.dd2` | elapsed milliseconds and buckets from `bmak.startTs` |
| `mst.kev`, `mst.mev`, `mst.pev`, `mst.tev`, `mst.oev` | keyboard, mouse, pointer, touch and orientation event counters |
| `mst.kc`, `mst.mc`, `mst.pc`, `mst.tc` | the matching per-class counts |
| `mst.tst` | accumulates on `touchmove` and `touchend` |
| `mst.jsrf` | the literal `PiZtE` |
| `mst.rval`, `mst.rcfp` | fingerprint values computed in the device block |
| `mst.nfas` | a 25-bit mask over `navigator.getGamepads`, `registerProtocolHandler`, `requestMediaKeySystemAccess`, `requestWakeLock` and others |
| `mst.tid` | `sessionStorage.getItem` |
| `tab` | a bitmask ORed on `keydown` |
| `ffs`, `inf` | the form inventory, one entry per `input`, `textarea` and `select` |

Fields whose chain ends at a literal are the interesting ones for anyone reproducing a build, because they are the values that must come from the script rather than the environment: `din.ibr`, `din.tsd`, `o9`, `mis`, `og`, `per`, `mst.it`, `mst.signals`, `ajt` are all constants on a clean desktop run.

## Generation 2, by section code

Positional sections, one code then one data block, joined by the per-post separator.

| code | contents |
| --- | --- |
| `-100` | device and screen block: user agent, `uaend`, capability integer, `productSub`, language, product, plugin count, screen and window dimensions, then the `cpen:` … `x12:` flags |
| `-101` | event support names, `do_en,dm_en,t_en` |
| `-102`, `-105` | pointer or touch event log, `;`-terminated tuples, duplicated on desktop |
| `-106` | counters |
| `-112` | document URL |
| `-115` | session block: counters, timestamps, the `_abck` cookie verbatim, the `PiZtE` literal |
| `-116`, `-119`, `-127`, `-70`, `-80` | single integers |
| `-122` | seven flags, three of which report automation |
| `-129` | a 64 hex build constant and trailing fields |
| `-131`, `-132` | feature flags in fourteen and five fields |
| `-134` | tail, a 40 hex value and a count |
| `-103`, `-108` to `-111`, `-114`, `-117`, `-123`, `-124`, `-126`, `-133` | empty on desktop, mobile or unrun code paths |

Inside `-115`, indices 0, 1 and 2 are event counters offset by 1, 32 and 32, index 5 is a fourth counter, index 6 sums them, index 7 is milliseconds since `bmak.startTs`, index 9 is `startTs` itself, index 20 is the `_abck` cookie verbatim and index 21 is the sum of its character codes below 128.

**How it is detected:** the counters and the event logs are the same fact reported twice. A payload whose logs show four pointer events and whose counters say none is inconsistent on its face, and the offsets mean the counters cannot simply be zeroed.

## The derived block

Generation 2 calls it `-90`, generation 3 calls it `ajr`. It is a computation check rather than a fact: pick a random line from the pointer log, sum the integers on it, factorise the sum keeping at most six divisors, and emit `divisors | line index | the line's values`.

With no pointer data at all the script fabricates five numbers instead, `random(1,5)`, `1`, `random(20,70)`, `random(100,300)`, `random(100,300)`, and reports the line index as `-1`:

```
1,445,5,89|-1|2,1,31,156,255
```

`2 + 1 + 31 + 156 + 255` is 445, whose divisors are 1, 5, 89 and 445.

**How it is detected:** the block is checkable against itself with no other information. A payload whose stated divisors do not factorise its own stated values is wrong on inspection, and a `-1` index says plainly that the client had no pointer input.

## Volatile, aged and stable

Not every difference between two payloads is a defect. Fields that differ between two real posts of one real session are volatile by measurement, not by opinion: `ajr`, `delt`, `ssts`, `sts`, `hal`, `hz1`, `ran`, `tst`, `kev`, `mev`, `pev`, `tev`, `oev`, `dvc`, `fct`, `tid`, `tovl`, `fmz`, and in generation 2 the timing header field, `-80`, `-90`, `-106`, `-127`, `-129` and several `-115` indices.

Two fields are coarse clock buckets that age out of any stored capture:

| field | divisor | steps about every |
| --- | --- | --- |
| `hz1` | 4,064,256 ms | 68 minutes |
| `dd2` | 93,477,888 ms | 26 hours |

Both are stable within one session, so they read as matches for as long as you only compare live runs. A capture replayed hours later differs by one, and that is the clock, not the client.
