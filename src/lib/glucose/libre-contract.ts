import { z } from "zod";

export const LIBRE_REGIONS = [
  "LA",
  "US",
  "EU",
  "EU2",
  "DE",
  "FR",
  "CA",
  "AU",
  "AP",
  "AE",
  "JP",
  "RU",
  "CN",
] as const;
const patient = z.string().uuid();
export const libreRequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("status"), pid: patient }),
  z.object({ action: z.literal("sync"), pid: patient }),
  z.object({ action: z.literal("disconnect"), pid: patient }),
  z.object({
    action: z.literal("login"),
    pid: patient,
    email: z.string().trim().email().max(254),
    password: z.string().min(1).max(512),
    region: z.enum(LIBRE_REGIONS),
    consent: z.literal(true),
  }),
  z.object({
    action: z.literal("select"),
    pid: patient,
    draft: z.string().uuid(),
    connection: z.string().min(1).max(128),
  }),
]);
export type LibreRequest = z.infer<typeof libreRequestSchema>;
export interface LibreStatus {
  ready: boolean;
  connected: boolean;
  expired: boolean;
  name: string | null;
  lastSync: string | null;
  error: string | null;
  setupIssue?: "server_configuration" | "database_schema";
}
export interface LibreCandidate {
  id: string;
  name: string;
}
export interface LibreResult {
  status?: LibreStatus;
  draft?: string;
  candidates?: LibreCandidate[];
  inserted?: number;
  error?: string;
}
export const LIBRE_ERRORS = {
  setup: "A conexão Libre ainda precisa ser ativada no servidor.",
  permission: "Você não tem permissão para gerenciar esta conexão.",
  credentials: "Não foi possível autenticar. Confira a conta do LibreLinkUp e a região.",
  account: "Abra o LibreLinkUp oficial e conclua as pendências da conta antes de conectar.",
  expired: "A sessão Libre expirou. Conecte a conta novamente.",
  throttled: "Limite de consultas atingido. Aguarde alguns minutos antes de tentar novamente.",
  unavailable: "O serviço Libre está indisponível ou bloqueou a conexão experimental.",
  format: "A resposta do Libre não pôde ser validada. Nenhuma leitura foi importada.",
  selection: "A pessoa selecionada não está mais compartilhando com esta conta.",
  retry: "Aguarde um minuto antes de tentar novamente.",
} as const;
export type LibreErrorCode = keyof typeof LIBRE_ERRORS;
