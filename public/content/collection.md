# What the sensor collects

Two sources answer this. An environment recorder installed before page scripts says what the sensor actually touched on one clean load, and the recovered string table names everything the build knows how to look for.

## Touched in a clean run

Recorded on a desktop Chrome load of a generation 2 property, counting only accesses whose call site is the sensor script:

| first seen | uses | property |
| --- | --- | --- |
| 1110 ms | 1342 | `navigator.userAgent` |
| 1169 ms | 339 | `window.innerWidth` |
| 1169 ms | 337 | `window.innerHeight` |
| 1170 ms | 329 | `navigator.language` |
| 1170 ms | 975 | `Math.random` |
| 1172 ms | 83 | `navigator.plugins` |
| 1175 ms | 12 | `navigator.webdriver` |
| 1176 ms | 997 | `document.documentElement` |
| 1164 ms | 307 | `Date.now` |
| 1680 ms | 4 | `screen.colorDepth`, `screen.pixelDepth` |
| 2188 ms | 1 | `canvas.getContext("webgl")` |
| 2190 ms | 2 | `getParameter(37445)` after `getExtension("WEBGL_debug_renderer_info")` |
| 2191 ms | 2 | `navigator.connection.rtt` |

Read a handful of times each: `maxTouchPoints`, `hardwareConcurrency` (8), `deviceMemory` (16), `productSub`, `product`, `onLine`, `cookieEnabled`, `doNotTrack`, `javaEnabled()`, `devicePixelRatio`, the four `screen` dimensions, `document.hidden`, and the existence of `credentials`, `bluetooth`, `storage`, `mediaDevices`, `permissions`, `serviceWorker`, `webkitTemporaryStorage`, `speechSynthesis`, `indexedDB`.

`storage.setItem("dummy", "test")` runs 23 times, which is a write-availability probe rather than persistence.

**How it is detected:** volume matters as much as value. A patched getter that returns a plausible string is fine; one that is slow, throws after a few hundred calls, or is installed on the instance rather than the prototype, is not. `navigator.userAgent` is read over a thousand times in a single load.

## Listeners

On `document`: `mousemove` and `touchmove` twice each, then `touchstart`, `touchend`, `touchcancel`, `click`, `mousedown`, `mouseup`, `pointerdown`, `pointerup`, `keydown`, `keyup`, `keypress`, `visibilitychange`. On `window`: `deviceorientation`, `devicemotion`, `blur`, `focus`.

Each of those handlers feeds counters that end up in the payload as named fields, so an event log and its counters have to move together. [Where fields come from](field-map.html) names which event drives which field.

## Named internals

The build's own vocabulary, recovered from the string table:

`buildPostData`, `calculateFP`, `getDeviceData`, `get_telemetry`, `collectHeadlessSignals`, `collectSeleniumData`, `checkIprSignals`, `calcSynthesisSpeechHash`, `synthesisSpeechHash`, `getHeartbeatTimestamp`, `extractAbckHeartbeatTimestamp`, `storeWebWideTrackingException`, `stripProxyFromErrors`, `setBraveSignal`, `getStorageUpdates`, `processAutopostRes`, `listFunctions`, `applyFunc`, `mouseMoveData`, `deltaTimestamp`, `totVel`, `stackLen`, `webGLVendor`, `webGLRenderer`, `webGLInfo`, `pluginsTest`, `pluginsLength`, `navigatorPermissions`, `navPerm`, `fpValStr`, `fpValCalculated`, `rCFP`, `powDone`, `_setPowState`, `_setIpr`, `_sdTrace`, `aprApTimer`, `aprApInFlight`, `failedAprApCnt`, `failedAprApBackoff`, `lastAprAutopostTS`.

`powDone` and `_setPowState` next to `_abck` and `bm_sz` are why the proof-of-work client is inside the sensor rather than being a separate script.

## Plugins are checked by name, not by length

The build carries around thirty legacy plugin names (`Shockwave Flash`, `Chrome PDF Viewer`, `Silverlight Plug-In`, `QuickTime Plug-in`, `Java Applet Plug-in`, `Widevine Content Decryption Module` and more) and looks each one up on the plugin array, emitting the index of each hit. A desktop Chrome emits `,7` for the PDF viewer.

Separately it reports `navigator.plugins.length` in its own field, and carries browser tells like `brave`, `brave_brws`, `opera`, `InstallTrigger` and `Trident/5.0` through `Trident/7.0`.

**How it is detected:** the two plugin fields have to agree. An emptied plugin array drops the length field to 0 and empties the hit list, which no real Chrome does; faking the length without faking named lookup fails the other half.

## Proxy-trap awareness

`stripProxyFromErrors`, and the string `at newHandler.<computed> [as apply]`, are aimed at `Proxy`-based patching: the script reads error stacks looking for the frame a trap leaves behind.

**How it is detected:** any instrumentation built on `Proxy` is visible to this check, including the recorders used to study the script. A run made with a proxy-based recorder is not a clean baseline, and treating it as one poisons every comparison made against it.

## Payload vocabulary in the table

Field markers appear verbatim in the string table: `,cpen:`, `,loc:`, `,s1:`, `,uaend,`, `bat:`, `cwen:`, `dm:`, `fc:`, `i1:`, `isc:`, `non:`, `opc:`, `sc:`, `vib:`, `wrc:`, `x11:`, `x12:`, alongside `<bpd>`, `</bpd>`, `<init/>` and the POST body template `{"sensor_data":"`. A run of negative integers from `-70` to `-134` is the section-code table for the generation 2 plaintext.
