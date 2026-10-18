// Déclarations minimales pour vérifier index.ts sous tsc (Deno n'est pas installé sur le Mac) : jamais importé, jamais déployé.
declare namespace Deno {
  const env: { get(k: string): string | undefined };
  function serve(h: (req: Request) => Response | Promise<Response>): void;
}
declare module '@supabase/supabase-js' { export function createClient(url: string, key: string, options?: any): any; }
