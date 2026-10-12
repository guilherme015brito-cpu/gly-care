import { describe, it, expect } from "vitest";
import { dailyScheduleSchema, visualProfileSchema, REFERENCE_PRESETS } from "@/lib/insulin/config";
import { illustrativeAction, demoActionApplications } from "@/lib/insulin/demo-action";

describe("Insulin metadata and schedules", () => {
  it("keeps schedules explicit, rejecting duplicate times and invalid doses", () => {
    expect(
      dailyScheduleSchema.parse([
        { time: "07:00", dose: 18 },
        { time: "22:00", dose: 12 },
      ]),
    ).toHaveLength(2);
    for (const a of [
      [{ time: "25:00", dose: 1 }],
      [{ time: "07:00", dose: 0 }],
      [
        { time: "07:00", dose: 1 },
        { time: "07:00", dose: 2 },
      ],
    ])
      expect(dailyScheduleSchema.safeParse(a).success).toBe(false);
  });
  it("requires coherent graph landmarks without a basal peak", () => {
    expect(visualProfileSchema.safeParse(REFERENCE_PRESETS.fiasp.visual_profile).success).toBe(
      true,
    );
    expect(
      visualProfileSchema.safeParse({ ...REFERENCE_PRESETS.lantus.visual_profile, peakMinutes: 60 })
        .success,
    ).toBe(false);
    expect(
      visualProfileSchema.safeParse({ ...REFERENCE_PRESETS.fiasp.visual_profile, peakMinutes: 400 })
        .success,
    ).toBe(false);
  });
  it("does not silently assume a product profile in Cloud", () => {
    const admin = {
      id: "a",
      insulin_id: "i",
      dose_units: 1,
      status: "performed",
      confirmed_by_user: true,
      is_superseded: false,
      administered_at: new Date().toISOString(),
    };
    const catalog = [{ id: "i", brand_name: "Fiasp" }];
    expect(demoActionApplications([admin as never], catalog as never, [])).toHaveLength(0);
    const profiles = [
      {
        insulin_id: "i",
        visual_profile: REFERENCE_PRESETS.fiasp.visual_profile,
        source_reference: REFERENCE_PRESETS.fiasp.source_reference,
      },
    ];
    const applications = demoActionApplications(
      [admin as never],
      catalog as never,
      profiles as never,
    );
    expect(applications).toHaveLength(1);
    expect(illustrativeAction(applications[0]!.profile, 300)).toBe(0);
  });
});
