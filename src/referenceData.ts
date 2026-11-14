export type InductionReferenceRow = {
  powerKw: number
  ratedCurrentA: number
  noLoadCurrentA: number
  slipFrequencyHz: number
  statorResistanceOhm: number
  leakageInductanceMh: number
  statorInductanceMh: number
  rotorTimeMs: number
}

// Raw constants from the workbook's "유도 전동기 상수 초기값" sheet.
// The workbook's calculation sheet contains no lookup/reference to this table,
// so these values are retained internally and are not applied automatically.
export const inductionInitialValues: Record<200 | 400, readonly InductionReferenceRow[]> = {
  200: [
    [0.2, 1.1, 0.8, 3.33, 14, 40.4, 385, 93],
    [0.4, 2.4, 1.4, 3.33, 6.7, 26.9, 206, 116],
    [0.75, 3.4, 1.7, 3, 2.6, 17.94, 174.4, 145],
    [1.5, 6.4, 2.6, 2.67, 1.17, 9.29, 115.8, 162],
    [2.2, 8.6, 3.3, 2.33, 0.84, 6.63, 90.7, 183],
    [3.7, 13.8, 5, 2.33, 0.5, 4.48, 59.7, 211],
    [5.5, 21, 7.1, 1.5, 0.314, 3.19, 41.5, 250],
    [7.5, 28.2, 9.3, 1.33, 0.169, 2.844, 31.86, 271],
    [11, 40, 12.4, 1, 0.12, 1.488, 23.91, 310],
    [15, 53.6, 15.5, 1, 0.084, 1.118, 19.07, 350],
    [18.5, 65.6, 19, 1, 0.068, 0.819, 15.59, 390],
    [22, 76.8, 21.5, 1, 0.056, 0.948, 13.79, 435],
    [30, 104.6, 29.3, 1, 0.042, 0.711, 10.12, 530],
    [37, 128.6, 34.7, 1, 0.033, 0.568, 8.54, 600],
    [45, 156, 42.1, 1, 0.028, 0.474, 7.04, 630],
    [55, 184.1, 49.7, 1, 0.023, 0.389, 5.96, 670],
    [75, 244.5, 61.1, 1, 0.016, 0.284, 4.85, 800],
    [90, 289.5, 72.3, 1, 0.014, 0.25, 4.09, 900],
  ].map(([powerKw, ratedCurrentA, noLoadCurrentA, slipFrequencyHz, statorResistanceOhm, leakageInductanceMh, statorInductanceMh, rotorTimeMs]) => ({ powerKw, ratedCurrentA, noLoadCurrentA, slipFrequencyHz, statorResistanceOhm, leakageInductanceMh, statorInductanceMh, rotorTimeMs })),
  400: [
    [0.2, 0.7, 0.5, 3.33, 28, 121.2, 1045, 93],
    [0.4, 1.4, 0.8, 3.33, 14, 80.8, 610, 116],
    [0.75, 2, 1, 3, 7.81, 53.9, 512, 145],
    [1.5, 3.7, 1.5, 2.67, 3.52, 27.9, 346, 162],
    [2.2, 5, 1.9, 2.33, 2.52, 19.95, 269.5, 183],
    [3.7, 8, 2.9, 2.33, 1.5, 13.45, 177.8, 211],
    [5.5, 12.1, 4.1, 1.5, 0.94, 9.62, 124.5, 250],
    [7.5, 16.3, 5.4, 1.33, 0.52, 8.53, 95.2, 271],
    [11, 23.2, 7.2, 1, 0.36, 4.48, 71.2, 310],
    [15, 31, 9, 1, 0.25, 3.38, 57, 350],
    [18.5, 38, 11, 1, 0.168, 2.457, 46.47, 390],
    [22, 44.5, 12.5, 1, 0.168, 2.844, 41.1, 435],
    [30, 60.5, 16.9, 1, 0.126, 2.133, 30.23, 530],
    [37, 74.4, 20.1, 1, 0.101, 1.704, 25.49, 600],
    [45, 90.3, 24.4, 1, 0.084, 1.422, 21.01, 630],
    [55, 106.6, 28.8, 1, 0.069, 1.167, 17.79, 670],
    [75, 141.6, 35.4, 1, 0.05, 0.852, 14.46, 800],
    [90, 167.6, 41.9, 1, 0.039, 0.715, 12.22, 900],
    [110, 203.5, 48.8, 1, 0.032, 0.585, 10.48, 1000],
    [132, 242.3, 58.1, 1, 0.027, 0.488, 8.8, 1100],
    [160, 290.5, 69.7, 1, 0.022, 0.403, 7.34, 1200],
    [185, 335, 77, 1, 0.021, 0.38, 6.64, 1250],
    [220, 405, 93.1, 30, 0.0163, 0.293, 5.467, 1350],
    [280, 530.7, 116.7, 30, 0.0128, 0.23, 4.386, 1400],
    [315, 604, 132.8, 30, 0.0114, 0.204, 3.854, 1430],
    [375, 729.7, 153.2, 30, 0.0096, 0.171, 3.342, 1470],
  ].map(([powerKw, ratedCurrentA, noLoadCurrentA, slipFrequencyHz, statorResistanceOhm, leakageInductanceMh, statorInductanceMh, rotorTimeMs]) => ({ powerKw, ratedCurrentA, noLoadCurrentA, slipFrequencyHz, statorResistanceOhm, leakageInductanceMh, statorInductanceMh, rotorTimeMs })),
}
