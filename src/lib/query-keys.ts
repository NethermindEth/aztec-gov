type KeyParams =
  | { type: "proposals-index" }
  | { type: "proposals-page"; filter: string; page: number }
  | { type: "proposal"; id: number };

export function buildKey(params: KeyParams): string {
  switch (params.type) {
    case "proposals-index":
      return "proposals-index";
    case "proposals-page":
      return `proposals-page:${params.filter}:${params.page}`;
    case "proposal":
      return `proposal:${params.id}`;
  }
}
