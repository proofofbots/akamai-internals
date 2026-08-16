# Automation markers

What the payload says about you when a driver is present. Measured by planting one marker before any page script, decoding the first payload, and diffing it against a clean run, with addresses that also move between two identical clean runs dropped as noise.

## The 32-bit mask

Generation 2 reports the whole automation set as one integer at `-115[28]`. Generation 3 reports it as `signals`. One bit per marker:

| bit | value | set by |
| --- | --- | --- |
| 0 | 1 | `window.__nightmare` |
| 1 | 2 | `window.cdc_adoQpoasnfa76pfcZLmcfl_Array` |
| 2 | 4 | `window.cdc_adoQpoasnfa76pfcZLmcfl_Promise` |
| 5 | 32 | `window._Selenium_IDE_Recorder` |
| 6 | 64 | `window.__$webdriverAsyncExecutor` |
| 7 | 128 | `window.__driver_evaluate` |
| 8 | 256 | `window.__driver_unwrapped` |
| 9 | 512 | `window.__fxdriver_evaluate` |
| 10 | 1024 | `window.__fxdriver_unwrapped` |
| 11 | 2048 | `window.__lastWatirAlert` |
| 12 | 4096 | `window.__lastWatirConfirm` |
| 13 | 8192 | `window.__lastWatirPrompt` |
| 14 | 16384 | `window.__phantomas` |
| 15 | 32768 | `window.__selenium_evaluate` |
| 16 | 65536 | `window.__selenium_unwrapped` |
| 17 | 131072 | `window.__webdriverFuncgeb` |
| 18 | 262144 | `window.__webdriver__chr` |
| 19 | 524288 | `window.__webdriver_evaluate` |
| 20 | 1048576 | `window.__webdriver_script_fn` |
| 21 | 2097152 | `window.__webdriver_script_func` |
| 22 | 4194304 | `window.__webdriver_script_function` |
| 23 | 8388608 | `window.__webdriver_unwrapped` |
| 24 | 16777216 | `window.awesomium` |
| 25 | 33554432 | `window.callSelenium` |
| 26 | 67108864 | `window.calledPhantom` |
| 27 | 134217728 | `window.calledSelenium` |
| 28 | 268435456 | `window.domAutomationController` |
| 29 | 536870912 | `window.watinExpressionError` |
| 30 | 1073741824 | `window.watinExpressionResult` |
| 31 | 2147483648 | `window.spynner_additional_js_loaded` |

Bits 3 and 4 were not triggered by any marker planted so far, so two names in the build's own list are still unaccounted for. `fmget_targets` came back as value 2, the same bit as the ChromeDriver `_Array` name; either it shares a bit or that single run was noise.

Note that the mask is emitted as a signed 32-bit integer, so bit 31 appears in a payload as `-2147483648`.

## Markers with their own fields

Several things report outside the mask, in more than one place at once:

| address (generation 2) | clean | tripped by |
| --- | --- | --- |
| `-115[29]` | `0` | `navigator.webdriver` true |
| `-122[2]` | `0` | `navigator.webdriver` true |
| `-122[3]` | `0` | `window.webdriver` truthy |
| `-100[9]` | `0` | `window.webdriver` truthy |
| `-122[0]` | `0` | `window.$cdc_asdjflasutopfhvcZLmcfl_` |
| `-100[8]` | `0` | `window._phantom` |
| `-100[21]` | `cpen:0` | `window.callPhantom` |
| `-100[7]` | `5` | `navigator.plugins.length`, so an emptied array reads `0` |

The generation 3 equivalents are named rather than positional: `din.wdr` for `navigator.webdriver`, `din.pha` for `_phantom`, `din.dau` for `domAutomation`, `sde` for the `$cdc_` probes on both `window` and `document`, `din.npl` for the plugin count and `din.adp` for the marker list.

**How it is detected:** the same fact is reported through two or three independent addresses. Hiding `navigator.webdriver` while leaving `window.webdriver` set, or the reverse, produces a payload that contradicts itself, which is a stronger signal than either flag alone.

## Planting `watinExpressionError` moves more than one field

One marker in the sweep moved the pointer event log as well as the mask: with it installed, `-102` went absent and `-109` gained five fields. That is worth knowing because it means the mask is not the only consequence of a marker, and a diff limited to `-115[28]` will under-report.

## What did not move anything

`window.driver`, `window.selenium`, a patched `Function.prototype.toString`, a replaced `Navigator.prototype.vendor` getter, a `Proxy`-wrapped `userAgent` getter, a patched `navigator.permissions.query`, a deleted `window.chrome`, an emptied `navigator.languages` and `hardwareConcurrency` of 1 all produced nothing outside the noise on the property tested.

Read that carefully. It does not mean those are undetectable. The build holds `stripProxyFromErrors` and the string `at newHandler.<computed> [as apply]`, and it calls `Function.prototype.toString` 34 times per load. It means those checks either report through a field that also moves on its own, or feed a verdict this property never acts on, or run on a path a monitoring configuration does not reach.

## The mask is not what gates

Setting the automation mask by hand in an otherwise correct payload and sending it to two production endpoints that do gate on the payload: both served the request. One is a login POST that refuses a payload with a moved key, and it serves the same payload with the automation mask set.

So on the endpoints measured, the payload check is "does this decode into a coherent session", not "does this session admit to being automated". The mask is collected and reported; it is not what the gate reads. That may be scoring rather than gating, and a property configured differently may well act on it.
