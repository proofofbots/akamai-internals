# Proof of work

The sensor carries its own proof-of-work client. There is no separate script and no separate endpoint: the challenge arrives inside the `_abck` cookie and the answer goes back inside the payload.

## Where the challenge comes from

`_abck` field 4 carries the work items, several of them separated by `||`, each `-`-separated:

```
<id>-<salt>-<difficulty>-<delay>-<slice>[-<version>]
```

```js
const challengesFromAbck = (value) => {
  const fields = decodeURIComponent(String(value)).split("~");
  if (fields.length < 5) return [];

  return fields[4].split("||").map(/* id, salt, difficulty, delay, slice, version */);
};
```

Items are taken with version 2 preferred over version 1. The token used in the prefix is `_abck` field 0, not the work item.

`delay` and `slice` are pacing, not difficulty: the first round starts after `delay` milliseconds, and the search yields to the event loop every 1000 attempts once it has spent more than `slice` milliseconds.

## The work

Ten rounds. Round `n` uses `difficulty + n` as its modulus and searches for a nonce such that the SHA-256 of the message, read as a big-endian integer, is `0` modulo that value.

```js
const prefix = `${challenge.token}${startTs}${challenge.salt}`;
const message = `${prefix}${difficulty}${nonce}`;

const remainder = (bytes, modulus) => {
  let value = 0;
  for (const byte of bytes) {
    value = ((value << 8) | byte) >>> 0;
    value %= modulus;
  }
  return value;
};
```

`bmak.startTs` is published on `window`, so the entire prefix is observable from the page. The nonce the sensor tries is `Math.random().toString(16)`, so a solver is free to enumerate instead. Expected work is one hash per `difficulty` attempts, which puts a difficulty of a few hundred at a few hundred hashes, single-digit milliseconds for three rounds.

## The answer

Four `;`-separated lists, in order: the nonces, the milliseconds per round, the attempts per round, and a trace filled only on the first round.

```
<nonces>,… ; <ms per round>,… ; <attempts per round>,… ; <trace>,… ;
```

The trace carries the salt, `startTs`, the challenge string, the prefix, the difficulty, the round modulus, the nonce, the message, the hash and the elapsed time since `startTs`. In other words the client reports how long its own CPU took, per round, alongside the answer.

**How it is detected:** the timing lists are as much of the answer as the nonces are. A solver that finishes ten rounds far faster than the hardware it claims to be, or that reports attempt counts inconsistent with the stated difficulty, is describing a machine that does not exist. The same problem appears in a different form for anyone running the sensor outside a browser: see the initialisation cost in [methodology](methodology.html).

## Status

The parse, the search and the answer format are implemented and self-consistent, but no property sampled has ever asked for work. The proof-of-work config bit was `0` on every host with a real obfuscated sensor path in every sweep so far, and `_abck` field 4 has been `-1` on all of them, so the round trip through a real edge is untested.
