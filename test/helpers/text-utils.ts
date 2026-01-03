export function stripANSI(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

export function hasText(output: string, text: string, ignoreCase = true): boolean {
  const searchText = ignoreCase ? text.toLowerCase() : text;
  const outputText = ignoreCase ? stripANSI(output).toLowerCase() : stripANSI(output);
  return outputText.includes(searchText);
}
