# What rotates

Several things move independently of each other, and reading a stale one as current is how a measurement goes wrong quietly.

## The script URL, per path and per day

The obfuscated path is not a stable identifier. On a generation 2 property sampled a day apart, the entire path changed while the script body did not: same byte count, same hash, different path and different config segment.

```
day 1  /IswGlZdNh/…/EQD3VDE5EipOtziE/…      209799 bytes
day 2  /bKPQf9papAAb/…/aYOGDfhYcEiODrXO/…   209799 bytes, same hash
```

The same origin can also serve different segments on different paths at the same moment, differing in one config bit, with identical script bytes on all of them.

So identify a build by the hash of its body. A survey keyed on the URL will count one build as several, and a cache keyed on the URL will serve the wrong answer after a rotation.

## The script body, in minutes

Sampled at fifteen-minute intervals, two generation 3 properties served three distinct script hashes each inside 31 minutes, with sizes moving over a 20 KB to 60 KB range. A generation 2 build served one hash for an afternoon and the same hash the next day.

The consequence is concrete: the generation 3 permutation key is a constant inside the build, so a key recovered from one fetch is worthless against a script fetched fifteen minutes later. Anything working against a live host has to fetch the script in the session that uses it. Pinned scripts are good for offline regression and nothing else.

## The delivery style itself

Two properties that named a full obfuscated sensor one day were serving only a 26.7 KB `/akam/13/<hash>` client the next. Treat a missing obfuscated path as a configuration that moved, not as a property that dropped Bot Manager.

## Per channel

The same build frames its payload differently depending on how it leaves the page:

```
posted sensor_data      2;2048;3360065;3683384;26,0,0,1,1,0;<body>
bmak.get_telemetry()    2;3228209;4601909;9,0,0,1,3,1;<body>
```

The header form has no bitmask field, so it has four header fields where the posted form has five. Any parser that assumed a fixed header length was wrong for one of the two.

## Per session

`_abck`, `bm_sz` and `ak_bmsc` are set on the first page load, and `_abck` is re-issued as the session goes on. A captured telemetry header from a session minutes old is refused where one built from the current cookies is served, so a replayed header measures replay handling and not payload quality.

## Per address, with a time limit

An endpoint that has served an address can keep answering it for a while, including requests it refused minutes earlier. That is why arms are ordered most-refusable-first and why a served answer only means something as the first request a cold client makes. Refusals stay meaningful throughout, because deny is computed per request rather than served from cache.

## Per tracking number, or whatever the endpoint keys its cache on

An endpoint's success response can be cached on the identifier in the request. Repeating the identifier answers from cache without the edge judging anything, and the giveaway is an identical `id` in the response body. Randomise it per run.

## Time buckets inside the payload

Two payload fields are coarse clock buckets, and both age out of a stored capture:

| field | divisor | steps about every |
| --- | --- | --- |
| `hz1` | 4,064,256 ms | 68 minutes |
| `dd2` | 93,477,888 ms | 26 hours |

Both are stable inside one session, so they read as matches indefinitely if you only ever compare live runs. A replayed capture differs by one or two, which is the clock, not a defect, and a comparison tool has to tolerate them on replay and refuse to tolerate them live.

The generation 2 preamble token carries a third one: the current hour bucket, digits rotated by a build constant.
