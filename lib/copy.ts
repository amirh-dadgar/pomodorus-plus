import copy from "./copy.json";

export { copy };

/** Fill `{placeholder}` tokens in a copy template, e.g. t(copy.timer.minutes, { m: "۲۵" }). */
export function t(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ""));
}
