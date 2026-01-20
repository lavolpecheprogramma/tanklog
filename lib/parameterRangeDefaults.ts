import type { TankType } from "@/composables/useTanks"

export type ParameterRangeStatus = "optimal" | "acceptable" | "critical"

export type DefaultParameterRangeRow = {
  parameter: string
  minValue: number | null
  maxValue: number | null
  unit: string
  status: ParameterRangeStatus
}

/**
 * Suggested parameter ranges dataset.
 *
 * Used in two places:
 * - Tank creation: auto-initializes `PARAMETER_RANGES` once (default starting point).
 * - Ranges editor: "Apply preset" (user-initiated replacement in the editor before saving).
 *
 * After creation, the app must never overwrite user-edited ranges automatically.
 *
 * Notes:
 * - These are "reasonable starting points" for hobbyist aquariums, not medical limits.
 * - Users should adapt based on livestock, husbandry, and test kit specifics.
 * - Parameter names MUST match what users log in WATER_TESTS.parameter (case-sensitive in Sheets, normalized in app).
 */
export function getDefaultParameterRangesForTankType(tankType: TankType): DefaultParameterRangeRow[] {
  if (tankType === "reef") {
    return [
      { parameter: "Temp", minValue: 24, maxValue: 26, unit: "°C", status: "optimal" },
      { parameter: "Temp", minValue: 23, maxValue: 27, unit: "°C", status: "acceptable" },
      { parameter: "Temp", minValue: 22, maxValue: 28, unit: "°C", status: "critical" },

      { parameter: "Salinity", minValue: 34.5, maxValue: 35.5, unit: "ppt", status: "optimal" },
      { parameter: "Salinity", minValue: 34, maxValue: 36, unit: "ppt", status: "acceptable" },
      { parameter: "Salinity", minValue: 33, maxValue: 37, unit: "ppt", status: "critical" },

      { parameter: "pH", minValue: 8.1, maxValue: 8.3, unit: "pH", status: "optimal" },
      { parameter: "pH", minValue: 7.8, maxValue: 8.4, unit: "pH", status: "acceptable" },
      { parameter: "pH", minValue: 7.7, maxValue: 8.5, unit: "pH", status: "critical" },

      { parameter: "KH", minValue: 7, maxValue: 9, unit: "dKH", status: "optimal" },
      { parameter: "KH", minValue: 6.5, maxValue: 10, unit: "dKH", status: "acceptable" },
      { parameter: "KH", minValue: 5.5, maxValue: 11.5, unit: "dKH", status: "critical" },

      { parameter: "Ca", minValue: 400, maxValue: 440, unit: "ppm", status: "optimal" },
      { parameter: "Ca", minValue: 380, maxValue: 460, unit: "ppm", status: "acceptable" },
      { parameter: "Ca", minValue: 350, maxValue: 480, unit: "ppm", status: "critical" },

      { parameter: "Mg", minValue: 1250, maxValue: 1350, unit: "ppm", status: "optimal" },
      { parameter: "Mg", minValue: 1200, maxValue: 1450, unit: "ppm", status: "acceptable" },
      { parameter: "Mg", minValue: 1100, maxValue: 1500, unit: "ppm", status: "critical" },

      { parameter: "NH3", minValue: 0, maxValue: 0, unit: "ppm", status: "optimal" },
      { parameter: "NH3", minValue: 0, maxValue: 0.02, unit: "ppm", status: "acceptable" },
      { parameter: "NH3", minValue: 0, maxValue: 0.05, unit: "ppm", status: "critical" },

      { parameter: "NO2", minValue: 0, maxValue: 0, unit: "ppm", status: "optimal" },
      { parameter: "NO2", minValue: 0, maxValue: 0.05, unit: "ppm", status: "acceptable" },
      { parameter: "NO2", minValue: 0, maxValue: 0.1, unit: "ppm", status: "critical" },

      { parameter: "NO3", minValue: 2, maxValue: 10, unit: "ppm", status: "optimal" },
      { parameter: "NO3", minValue: 0, maxValue: 20, unit: "ppm", status: "acceptable" },
      { parameter: "NO3", minValue: 0, maxValue: 50, unit: "ppm", status: "critical" },

      { parameter: "PO4", minValue: 0.02, maxValue: 0.1, unit: "ppm", status: "optimal" },
      { parameter: "PO4", minValue: 0, maxValue: 0.2, unit: "ppm", status: "acceptable" },
      { parameter: "PO4", minValue: 0, maxValue: 0.4, unit: "ppm", status: "critical" },
    ]
  }

  if (tankType === "marine") {
    return [
      { parameter: "Temp", minValue: 24, maxValue: 26, unit: "°C", status: "optimal" },
      { parameter: "Temp", minValue: 23, maxValue: 27, unit: "°C", status: "acceptable" },
      { parameter: "Temp", minValue: 22, maxValue: 28, unit: "°C", status: "critical" },

      { parameter: "Salinity", minValue: 34, maxValue: 36, unit: "ppt", status: "optimal" },
      { parameter: "Salinity", minValue: 33, maxValue: 37, unit: "ppt", status: "acceptable" },
      { parameter: "Salinity", minValue: 32, maxValue: 38, unit: "ppt", status: "critical" },

      { parameter: "pH", minValue: 8.0, maxValue: 8.3, unit: "pH", status: "optimal" },
      { parameter: "pH", minValue: 7.8, maxValue: 8.4, unit: "pH", status: "acceptable" },
      { parameter: "pH", minValue: 7.6, maxValue: 8.5, unit: "pH", status: "critical" },

      { parameter: "KH", minValue: 7, maxValue: 10, unit: "dKH", status: "optimal" },
      { parameter: "KH", minValue: 6, maxValue: 11, unit: "dKH", status: "acceptable" },
      { parameter: "KH", minValue: 5, maxValue: 12.5, unit: "dKH", status: "critical" },

      { parameter: "NH3", minValue: 0, maxValue: 0, unit: "ppm", status: "optimal" },
      { parameter: "NH3", minValue: 0, maxValue: 0.02, unit: "ppm", status: "acceptable" },
      { parameter: "NH3", minValue: 0, maxValue: 0.05, unit: "ppm", status: "critical" },

      { parameter: "NO2", minValue: 0, maxValue: 0, unit: "ppm", status: "optimal" },
      { parameter: "NO2", minValue: 0, maxValue: 0.1, unit: "ppm", status: "acceptable" },
      { parameter: "NO2", minValue: 0, maxValue: 0.2, unit: "ppm", status: "critical" },

      { parameter: "NO3", minValue: 0, maxValue: 20, unit: "ppm", status: "optimal" },
      { parameter: "NO3", minValue: 0, maxValue: 40, unit: "ppm", status: "acceptable" },
      { parameter: "NO3", minValue: 0, maxValue: 80, unit: "ppm", status: "critical" },

      { parameter: "PO4", minValue: 0, maxValue: 0.2, unit: "ppm", status: "optimal" },
      { parameter: "PO4", minValue: 0, maxValue: 0.3, unit: "ppm", status: "acceptable" },
      { parameter: "PO4", minValue: 0, maxValue: 0.5, unit: "ppm", status: "critical" },
    ]
  }

  if (tankType === "planted") {
    return [
      { parameter: "Temp", minValue: 23, maxValue: 26, unit: "°C", status: "optimal" },
      { parameter: "Temp", minValue: 22, maxValue: 28, unit: "°C", status: "acceptable" },
      { parameter: "Temp", minValue: 20, maxValue: 30, unit: "°C", status: "critical" },

      { parameter: "pH", minValue: 6.2, maxValue: 7.0, unit: "pH", status: "optimal" },
      { parameter: "pH", minValue: 5.8, maxValue: 7.5, unit: "pH", status: "acceptable" },
      { parameter: "pH", minValue: 5.5, maxValue: 8.0, unit: "pH", status: "critical" },

      { parameter: "KH", minValue: 2, maxValue: 6, unit: "dKH", status: "optimal" },
      { parameter: "KH", minValue: 1, maxValue: 8, unit: "dKH", status: "acceptable" },
      { parameter: "KH", minValue: 0.5, maxValue: 10, unit: "dKH", status: "critical" },

      { parameter: "GH", minValue: 4, maxValue: 10, unit: "dGH", status: "optimal" },
      { parameter: "GH", minValue: 3, maxValue: 14, unit: "dGH", status: "acceptable" },
      { parameter: "GH", minValue: 2, maxValue: 18, unit: "dGH", status: "critical" },

      { parameter: "NH3", minValue: 0, maxValue: 0, unit: "ppm", status: "optimal" },
      { parameter: "NH3", minValue: 0, maxValue: 0.02, unit: "ppm", status: "acceptable" },
      { parameter: "NH3", minValue: 0, maxValue: 0.05, unit: "ppm", status: "critical" },

      { parameter: "NO2", minValue: 0, maxValue: 0, unit: "ppm", status: "optimal" },
      { parameter: "NO2", minValue: 0, maxValue: 0.1, unit: "ppm", status: "acceptable" },
      { parameter: "NO2", minValue: 0, maxValue: 0.2, unit: "ppm", status: "critical" },

      { parameter: "NO3", minValue: 5, maxValue: 20, unit: "ppm", status: "optimal" },
      { parameter: "NO3", minValue: 0, maxValue: 30, unit: "ppm", status: "acceptable" },
      { parameter: "NO3", minValue: 0, maxValue: 50, unit: "ppm", status: "critical" },

      { parameter: "PO4", minValue: 0.2, maxValue: 1.5, unit: "ppm", status: "optimal" },
      { parameter: "PO4", minValue: 0.05, maxValue: 2.0, unit: "ppm", status: "acceptable" },
      { parameter: "PO4", minValue: 0, maxValue: 3.0, unit: "ppm", status: "critical" },

      { parameter: "Fe", minValue: 0.05, maxValue: 0.2, unit: "ppm", status: "optimal" },
      { parameter: "Fe", minValue: 0.02, maxValue: 0.3, unit: "ppm", status: "acceptable" },
      { parameter: "Fe", minValue: 0, maxValue: 0.5, unit: "ppm", status: "critical" },
    ]
  }

  // freshwater (default)
  return [
    { parameter: "Temp", minValue: 24, maxValue: 26, unit: "°C", status: "optimal" },
    { parameter: "Temp", minValue: 22, maxValue: 28, unit: "°C", status: "acceptable" },
    { parameter: "Temp", minValue: 20, maxValue: 30, unit: "°C", status: "critical" },

    { parameter: "pH", minValue: 7.0, maxValue: 7.5, unit: "pH", status: "optimal" },
    { parameter: "pH", minValue: 6.5, maxValue: 8.0, unit: "pH", status: "acceptable" },
    { parameter: "pH", minValue: 6.0, maxValue: 8.5, unit: "pH", status: "critical" },

    { parameter: "KH", minValue: 4, maxValue: 8, unit: "dKH", status: "optimal" },
    { parameter: "KH", minValue: 3, maxValue: 10, unit: "dKH", status: "acceptable" },
    { parameter: "KH", minValue: 1, maxValue: 12, unit: "dKH", status: "critical" },

    { parameter: "GH", minValue: 6, maxValue: 12, unit: "dGH", status: "optimal" },
    { parameter: "GH", minValue: 4, maxValue: 16, unit: "dGH", status: "acceptable" },
    { parameter: "GH", minValue: 2, maxValue: 20, unit: "dGH", status: "critical" },

    { parameter: "NH3", minValue: 0, maxValue: 0, unit: "ppm", status: "optimal" },
    { parameter: "NH3", minValue: 0, maxValue: 0.02, unit: "ppm", status: "acceptable" },
    { parameter: "NH3", minValue: 0, maxValue: 0.05, unit: "ppm", status: "critical" },

    { parameter: "NO2", minValue: 0, maxValue: 0, unit: "ppm", status: "optimal" },
    { parameter: "NO2", minValue: 0, maxValue: 0.1, unit: "ppm", status: "acceptable" },
    { parameter: "NO2", minValue: 0, maxValue: 0.2, unit: "ppm", status: "critical" },

    { parameter: "NO3", minValue: 0, maxValue: 20, unit: "ppm", status: "optimal" },
    { parameter: "NO3", minValue: 0, maxValue: 40, unit: "ppm", status: "acceptable" },
    { parameter: "NO3", minValue: 0, maxValue: 80, unit: "ppm", status: "critical" },

    { parameter: "PO4", minValue: 0, maxValue: 1.0, unit: "ppm", status: "optimal" },
    { parameter: "PO4", minValue: 0, maxValue: 2.0, unit: "ppm", status: "acceptable" },
    { parameter: "PO4", minValue: 0, maxValue: 5.0, unit: "ppm", status: "critical" },
  ]
}

