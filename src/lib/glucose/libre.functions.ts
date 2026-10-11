import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { libreRequestSchema, type LibreRequest, type LibreResult } from "./libre-contract";

export const libreRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: LibreRequest) => libreRequestSchema.parse(input))
  .handler(async ({ data, context }): Promise<LibreResult> => {
    setResponseHeader("Cache-Control", "no-store");
    const url = new URL(getRequest().url);
    if (url.protocol !== "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
      return { error: "Use uma conexão HTTPS para conectar o Libre." };
    const { handleLibre } = await import("./libre.server");
    return handleLibre(data, context.userId, context.supabase);
  });
