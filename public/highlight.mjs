const escapeHtml = (text) =>
  String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const JS_KEYWORDS = new Set([
  "async", "await", "break", "case", "catch", "class", "const", "continue", "default", "delete",
  "do", "else", "export", "extends", "finally", "for", "from", "function", "if", "import", "in",
  "instanceof", "let", "new", "of", "return", "static", "switch", "throw", "try", "typeof", "var",
  "void", "while", "yield",
]);

const JS_CONSTANTS = new Set(["true", "false", "null", "undefined", "NaN", "Infinity", "this"]);

const JS_BUILTINS = new Set([
  "Array", "Boolean", "Buffer", "Date", "Error", "Function", "JSON", "Map", "Math", "Number",
  "Object", "Promise", "Proxy", "RegExp", "Set", "String", "Symbol", "URL", "URLSearchParams",
  "console", "document", "navigator", "screen", "window",
]);

const NAME_START = /[A-Za-z_$]/;
const NAME_PART = /[\w$]/;
const DIGIT = /[0-9]/;

const emit = (out, cls, value) => {
  if (!value) return;
  out.push(cls ? `<span class="hl-${cls}">${escapeHtml(value)}</span>` : escapeHtml(value));
};

const readString = (code, start) => {
  const quote = code[start];
  let index = start + 1;

  while (index < code.length) {
    if (code[index] === "\\") {
      index += 2;
      continue;
    }
    if (code[index] === quote) return index + 1;
    if (quote !== "`" && code[index] === "\n") return index;
    index += 1;
  }

  return index;
};

const highlightJs = (code) => {
  const out = [];
  let index = 0;

  while (index < code.length) {
    const character = code[index];

    if (character === "/" && code[index + 1] === "/") {
      const end = code.indexOf("\n", index);
      const stop = end === -1 ? code.length : end;
      emit(out, "c", code.slice(index, stop));
      index = stop;
      continue;
    }

    if (character === "/" && code[index + 1] === "*") {
      const end = code.indexOf("*/", index + 2);
      const stop = end === -1 ? code.length : end + 2;
      emit(out, "c", code.slice(index, stop));
      index = stop;
      continue;
    }

    if (character === '"' || character === "'" || character === "`") {
      const stop = readString(code, index);
      emit(out, "s", code.slice(index, stop));
      index = stop;
      continue;
    }

    if (DIGIT.test(character) || (character === "." && DIGIT.test(code[index + 1] ?? ""))) {
      let stop = index;
      while (stop < code.length && /[0-9a-fA-FxX._]/.test(code[stop])) stop += 1;
      emit(out, "m", code.slice(index, stop));
      index = stop;
      continue;
    }

    if (NAME_START.test(character)) {
      let stop = index;
      while (stop < code.length && NAME_PART.test(code[stop])) stop += 1;
      const word = code.slice(index, stop);
      const next = code.slice(stop).match(/^\s*(.)/)?.[1] ?? "";
      const previous = code.slice(0, index).match(/(\S)\s*$/)?.[1] ?? "";

      let cls = null;
      if (JS_KEYWORDS.has(word)) cls = "k";
      else if (JS_CONSTANTS.has(word)) cls = "kc";
      else if (next === "(") cls = "nf";
      else if (JS_BUILTINS.has(word)) cls = "nb";
      else if (next === ":" && previous !== "?") cls = "na";

      emit(out, cls, word);
      index = stop;
      continue;
    }

    if ("{}()[];,.:".includes(character)) {
      emit(out, "p", character);
      index += 1;
      continue;
    }

    if ("+-*/%=<>!&|^~?".includes(character)) {
      let stop = index;
      while (stop < code.length && "+-*/%=<>!&|^~?".includes(code[stop])) stop += 1;
      emit(out, "o", code.slice(index, stop));
      index = stop;
      continue;
    }

    emit(out, null, character);
    index += 1;
  }

  return out.join("");
};

const highlightJson = (code) => {
  const out = [];
  let index = 0;

  while (index < code.length) {
    const character = code[index];

    if (character === '"') {
      const stop = readString(code, index);
      const isKey = /^\s*:/.test(code.slice(stop));
      emit(out, isKey ? "na" : "s", code.slice(index, stop));
      index = stop;
      continue;
    }

    if (DIGIT.test(character) || (character === "-" && DIGIT.test(code[index + 1] ?? ""))) {
      let stop = index + 1;
      while (stop < code.length && /[0-9.eE+-]/.test(code[stop])) stop += 1;
      emit(out, "m", code.slice(index, stop));
      index = stop;
      continue;
    }

    if (NAME_START.test(character)) {
      let stop = index;
      while (stop < code.length && NAME_PART.test(code[stop])) stop += 1;
      const word = code.slice(index, stop);
      emit(out, JS_CONSTANTS.has(word) ? "kc" : null, word);
      index = stop;
      continue;
    }

    if ("{}[],:".includes(character)) {
      emit(out, "p", character);
      index += 1;
      continue;
    }

    emit(out, null, character);
    index += 1;
  }

  return out.join("");
};

const highlightHtml = (code) => {
  const out = [];
  let index = 0;

  while (index < code.length) {
    const open = code.indexOf("<", index);

    if (open === -1) {
      emit(out, null, code.slice(index));
      break;
    }

    emit(out, null, code.slice(index, open));

    let close = -1;
    let quote = "";

    for (let scan = open + 1; scan < code.length; scan += 1) {
      const at = code[scan];

      if (quote) {
        if (at === quote) quote = "";
        continue;
      }

      if (at === '"' || at === "'") {
        quote = at;
        continue;
      }

      if (at === ">") {
        close = scan;
        break;
      }
    }

    if (close === -1) {
      emit(out, null, code.slice(open));
      break;
    }

    const tag = code.slice(open, close + 1);
    const name = tag.match(/^<\/?([A-Za-z][\w-]*)/);

    if (!name) {
      emit(out, null, tag);
      index = close + 1;
      continue;
    }

    emit(out, "p", tag.startsWith("</") ? "</" : "<");
    emit(out, "nt", name[1]);

    let rest = tag.slice(1 + (tag.startsWith("</") ? 1 : 0) + name[1].length, -1);

    while (rest.length) {
      const attribute = rest.match(/^(\s*)([\w:-]+)(\s*=\s*)?("[^"]*"|'[^']*')?/);
      if (!attribute || (!attribute[2] && !attribute[1])) break;

      emit(out, null, attribute[1]);
      emit(out, "na", attribute[2]);
      emit(out, "o", attribute[3] ?? "");
      emit(out, "s", attribute[4] ?? "");
      rest = rest.slice(attribute[0].length);
      if (!attribute[0].length) break;
    }

    emit(out, null, rest);
    emit(out, "p", ">");
    index = close + 1;
  }

  return out.join("");
};

const highlightText = (code) => {
  const out = [];
  let index = 0;

  while (index < code.length) {
    const character = code[index];

    if (character === "<") {
      const close = code.indexOf(">", index);
      if (close !== -1 && close - index < 40 && !code.slice(index, close).includes("\n")) {
        emit(out, "nv", code.slice(index, close + 1));
        index = close + 1;
        continue;
      }
    }

    if (character === '"' || character === "'") {
      const stop = readString(code, index);
      emit(out, "s", code.slice(index, stop));
      index = stop;
      continue;
    }

    if (DIGIT.test(character)) {
      let stop = index;
      while (stop < code.length && /[0-9a-fA-Fx._]/.test(code[stop])) stop += 1;
      const word = code.slice(index, stop);
      emit(out, /^[0-9][0-9a-fA-Fx._]*$/.test(word) ? "m" : null, word);
      index = stop;
      continue;
    }

    if (NAME_START.test(character)) {
      let stop = index;
      while (stop < code.length && NAME_PART.test(code[stop])) stop += 1;
      const word = code.slice(index, stop);
      const next = code.slice(stop).match(/^\s*(.)/)?.[1] ?? "";
      emit(out, next === ":" || next === "=" ? "na" : null, word);
      index = stop;
      continue;
    }

    if (";|,".includes(character)) {
      emit(out, "p", character);
      index += 1;
      continue;
    }

    emit(out, null, character);
    index += 1;
  }

  return out.join("");
};

const LANGUAGES = {
  js: highlightJs,
  javascript: highlightJs,
  json: highlightJson,
  html: highlightHtml,
  text: highlightText,
};

export const highlight = (code, language = "") => {
  const chosen = LANGUAGES[language.toLowerCase()] ?? highlightText;
  return chosen(code);
};
