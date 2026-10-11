import { z } from "zod";

export const visualProfileSchema = z
  .object({
    role: z.enum(["rapid", "basal"]),
    onsetMinutes: z.number().finite().min(0).max(1440),
    peakMinutes: z.number().finite().positive().nullable(),
    durationMinutes: z.number().finite().positive().max(4320),
  })
  .superRefine((p, ctx) => {
    if (
      p.onsetMinutes >= p.durationMinutes ||
      (p.role === "rapid" &&
        (p.peakMinutes == null ||
          p.peakMinutes <= p.onsetMinutes ||
          p.peakMinutes >= p.durationMinutes)) ||
      (p.role === "basal" && p.peakMinutes !== null)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Confira inicio, pico e duracao do perfil ilustrativo.",
      });
    }
  });
export type VisualProfile = z.infer<typeof visualProfileSchema>;
export const dailyScheduleSchema = z
  .array(
    z.object({
      time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      dose: z
        .number()
        .finite()
        .min(0.5)
        .max(300)
        .refine((n) => Math.abs(n * 10 - Math.round(n * 10)) < 1e-7),
    }),
  )
  .max(6)
  .refine((a) => new Set(a.map((x) => x.time)).size === a.length, "Horarios repetidos.");
export type DailySchedule = z.infer<typeof dailyScheduleSchema>;

// Drawing landmarks, not patient-specific pharmacodynamic measurements.
export const REFERENCE_PRESETS = {
  fiasp: {
    onset_text: "Inicio rapido; cerca de 16 a 20 min no estudo americano",
    peak_text: "Maior efeito entre 1 e 3 h",
    effective_duration_text: "3 a 5 h; varia com dose e pessoa",
    max_duration_text: "Nao universal: estudos americanos observaram 5 a 7 h",
    source_reference: "https://www.novo-pi.com/fiasp.pdf",
    visual_profile: {
      role: "rapid",
      onsetMinutes: 17,
      peakMinutes: 120,
      durationMinutes: 300,
    } as VisualProfile,
  },
  lantus: {
    onset_text: "Absorcao gradual; inicio nao fixo",
    peak_text: "Sem pico pronunciado",
    effective_duration_text: "Cerca de 24 h; variavel",
    max_duration_text: "24 h e referencia, nao limite individual garantido",
    source_reference: "https://products.sanofi.us/lantus/lantus.html",
    visual_profile: {
      role: "basal",
      onsetMinutes: 60,
      peakMinutes: null,
      durationMinutes: 1440,
    } as VisualProfile,
  },
};
