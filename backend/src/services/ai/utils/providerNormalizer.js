/**
 * Normalizes AI provider raw responses into a consistent structured contract.
 * Also wraps the response with String methods to support backwards compatibility
 * for callers expecting a simple raw string return.
 */
export function normalizeResponse({ 
  provider, 
  model, 
  text, 
  usage, 
  finishReason, 
  latency, 
  inputTokens, 
  outputTokens 
}) {
  const normalizedText = text || '';
  const promptTokens = inputTokens || usage?.prompt_tokens || 0;
  const completionTokens = outputTokens || usage?.completion_tokens || 0;
  const totalTokens = usage?.total_tokens || (promptTokens + completionTokens);

  const baseResult = {
    provider,
    model,
    text: normalizedText,
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens
    },
    finishReason: finishReason || 'stop',
    latency: latency || 0,
    inputTokens: promptTokens,
    outputTokens: completionTokens,
    cached: false
  };

  // Create proxy mapping String functions to baseResult.text
  const stringProxy = {
    ...baseResult,
    
    toString() {
      return this.text;
    },
    trim() {
      return this.text.trim();
    },
    split(separator, limit) {
      return this.text.split(separator, limit);
    },
    substring(start, end) {
      return this.text.substring(start, end);
    },
    substr(start, length) {
      return this.text.substr(start, length);
    },
    startsWith(searchString, position) {
      return this.text.startsWith(searchString, position);
    },
    endsWith(searchString, length) {
      return this.text.endsWith(searchString, length);
    },
    indexOf(searchValue, fromIndex) {
      return this.text.indexOf(searchValue, fromIndex);
    },
    lastIndexOf(searchValue, fromIndex) {
      return this.text.lastIndexOf(searchValue, fromIndex);
    },
    slice(start, end) {
      return this.text.slice(start, end);
    },
    replace(searchValue, replaceValue) {
      return this.text.replace(searchValue, replaceValue);
    },
    replaceAll(searchValue, replaceValue) {
      return this.text.replaceAll(searchValue, replaceValue);
    },
    toLowerCase() {
      return this.text.toLowerCase();
    },
    toUpperCase() {
      return this.text.toUpperCase();
    },
    match(regexp) {
      return this.text.match(regexp);
    },
    matchAll(regexp) {
      return this.text.matchAll(regexp);
    },
    search(regexp) {
      return this.text.search(regexp);
    },
    concat(...strings) {
      return this.text.concat(...strings);
    },
    includes(searchString, position) {
      return this.text.includes(searchString, position);
    },
    
    get length() {
      return this.text.length;
    }
  };

  // Define implicit conversion to string primitives (e.g. for string concatenation)
  Object.defineProperty(stringProxy, Symbol.toPrimitive, {
    value(hint) {
      return this.text;
    },
    writable: false,
    configurable: false,
    enumerable: false
  });

  return stringProxy;
}

export default { normalizeResponse };
