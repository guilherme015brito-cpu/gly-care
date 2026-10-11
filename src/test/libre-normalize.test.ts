import { describe, expect, it } from "vitest";
import { libreTimestamp, normalizeLibreGraph } from "@/lib/glucose/libre-normalize";
import { getDemoStore, resetDemoStore } from "@/lib/data/demo-store";
import { LibreLinkUpProvider } from "@/lib/glucose/providers";

const now = Date.UTC(2026, 9, 11, 15);
const point = { FactoryTimestamp: "10/11/2026 2:55:00 PM", ValueInMgPerDl: 123 };
function graph() {
  return {
    connection: { patientId: "invented-person", glucoseMeasurement: { ...point, TrendArrow: 4 } },
    graphData: [point],
  };
}
describe("Libre timestamps", () => {
  it.each([
    ["10/11/2026 2:55:00 PM", "2026-10-11T14:55:00.000Z"],
    ["10/11/2026 12:01:00 AM", "2026-10-11T00:01:00.000Z"],
    ["10/11/2026 12:01:00 PM", "2026-10-11T12:01:00.000Z"],
    ["2026-10-11 14:55:00", "2026-10-11T14:55:00.000Z"],
    ["2026-10-11T11:55:00-03:00", "2026-10-11T14:55:00.000Z"],
  ])("parses %s as UTC", (input, expected) => expect(libreTimestamp(input)).toBe(expected));
  it.each([
    "garbage",
    "2026-02-30T14:55:00Z",
    "02/30/2026 2:55:00 PM",
    "10/11/2026 13:55:00 PM",
    "2026-13-11 14:55:00",
    "2026-10-11 25:00:00",
    "11/10/26 14:55",
  ])("rejects invalid/ambiguous %s", (input) => expect(libreTimestamp(input)).toBeNull());
});
describe("Libre normalization", () => {
  it("deduplicates and gives current measurement its supplied trend", () => {
    const rows = normalizeLibreGraph(graph(), "invented-person", now);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      source: "external",
      provider_id: "librelinkup",
      value: 123,
      unit: "mg/dL",
      trend: "rising",
      measured_at: "2026-10-11T14:55:00.000Z",
    });
    expect(rows[0]).not.toHaveProperty("raw_payload");
  });
  it("does not interpolate gaps or invent a trend", () => {
    const payload = graph();
    payload.graphData.push({ ...point, FactoryTimestamp: "10/11/2026 1:00:00 PM" });
    const rows = normalizeLibreGraph(payload, "invented-person", now);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.trend).toBe("unknown");
  });
  it("rejects a different person", () =>
    expect(() => normalizeLibreGraph(graph(), "another-person", now)).toThrow("selection"));
  it("rejects invalid values without importing a partial batch", () => {
    const payload = graph();
    payload.graphData.push({ ...point, ValueInMgPerDl: NaN });
    expect(() => normalizeLibreGraph(payload, "invented-person", now)).toThrow();
  });
  it("rejects future timestamps", () =>
    expect(() => normalizeLibreGraph(graph(), "invented-person", now - 3600000)).toThrow("format"));
  it("flags sensor saturation without turning it into a precise valid reading", () => {
    const payload = {
      ...graph(),
      connection: { patientId: "invented-person", glucoseMeasurement: { ...point, isHigh: true } },
    };
    expect(normalizeLibreGraph(payload, "invented-person", now)[0]).toMatchObject({
      quality: "questionable",
      notes: "Leitura limitada pelo sensor (HI).",
    });
  });
  it("rejects real ingestion and connection in Demo", async () => {
    resetDemoStore();
    const store = getDemoStore();
    await expect(
      store.ingestGlucose("demo", normalizeLibreGraph(graph(), "invented-person", now)),
    ).rejects.toThrow("demonstração");
    await expect(store.libre({ action: "sync", pid: "demo" })).rejects.toThrow("demonstração");
  });
  it("provider cannot fetch without a server fetcher", async () => {
    const provider = new LibreLinkUpProvider();
    expect(provider.status()).toBe("not_configured");
    await expect(provider.fetchSince(new Date())).rejects.toThrow("não configurada");
  });
});
