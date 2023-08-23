export function injectCodeByRegex(
  fileContent: string,
  lineRegex: RegExp,
  snippet: string
) {
  const lines = fileContent.split('\n');
  const index = lines.findIndex((line) => lineRegex.test(line));
  let content: string[] = lines;

  if (index > -1) {
    content = [...lines.slice(0, index), snippet, ...lines.slice(index)];
  }

  return content;
}

export function injectCodeByMultiLineRegex(
  fileContent: string,
  lineRegex: RegExp,
  snippet: string
) {
  return fileContent.replace(lineRegex, `$&\n${snippet}`);
}

export function injectCodeBeforeMultiLineRegex(
  fileContent: string,
  lineRegex: RegExp,
  snippet: string
) {
  return fileContent.replace(lineRegex, `${snippet}\n$&`);
}

export function replaceCodeByRegex(
  fileContent: string,
  lineRegex: RegExp,
  snippet: string
) {
  return fileContent.replace(lineRegex, snippet);
}

export function matchRegexExists(fileContent: string, regex: RegExp) {
  return regex.test(fileContent);
}
export function injectCodeByMultiLineRegexAndReplaceLine(
  fileContent: string,
  lineRegex: RegExp,
  snippet: string
) {
  return fileContent.replace(lineRegex, `${snippet}`);
}

export function injectCodeByLineNumber(
  fileContent: string,
  index: number,
  snippet: string
) {
  const lines = fileContent.split('\n');
  let content: string[] = lines;

  if (index > -1) {
    content = [...lines.slice(0, index), snippet, ...lines.slice(index)];
  }

  return content;
}
