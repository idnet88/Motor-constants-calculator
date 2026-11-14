import { describe, expect, it } from 'vitest'
import { calculateInduction, calculateSynchronous } from './calculations'

describe('attached workbook example sheets', () => {
  it('matches the induction example constant cells', () => {
    const result = calculateInduction({
      powerW: 5500,
      poles: 4,
      frequencyHz: 50,
      ratedSpeedRpm: 1450,
      ratedVoltageV: 400,
      ratedCurrentA: 10.9,
      efficiency: 0.877,
      idFloor: 0.5,
      fieldWeakeningStart: 1,
      voltageHeadroom: 0.05,
      lineResistanceOhm: 1.5,
      loadFactor: 1,
      sweepHz: Array.from({ length: 24 }, (_, index) => (index + 1) * 5),
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const excelExample = [
      [result.value.rsAverageOhm, 0.75], // C102
      [result.value.noLoadCurrentMinA, 3.8276974268137156], // C97
      [result.value.noLoadCurrentAverageA, 4.3663487134068575], // C98
      [result.value.noLoadCurrentMaxA, 4.905], // C99
      [result.value.leakageAverageMh, 9.174311926605503], // C106
      [result.value.statorAverageMh, 165.13761467889907], // C114
      [result.value.rotorTimeAverageMs, 331.8698976826471], // C118
      [result.value.magnetizingAverageMh, 160.55045871559633], // C110
    ]
    const maxAbsoluteDifference = Math.max(...excelExample.map(([actual, expected]) => Math.abs(actual - expected)))
    expect(maxAbsoluteDifference).toBeLessThan(1e-8)
  })

  it('matches the synchronous example constant cells', () => {
    const result = calculateSynchronous({
      powerW: 7460,
      poles: 10,
      frequencyHz: 180,
      ratedVoltageV: 460,
      ratedCurrentA: 11.7,
      lineResistanceOhm: 0.55,
      lqTunedMh: 11,
      ldTunedMh: 9,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const excelExample = [
      [result.value.kePeakLineLineVPerKrpm, 241.02027911209393], // C35
      [result.value.kePeakPhaseVPerKrpm, 139.15312302552618], // C36
      [result.value.keRmsLineLineVPerKrpm, 170.427073763636], // C37
      [result.value.keRmsPhaseVPerKrpm, 98.39611691463546], // C38
      [result.value.pmFluxRefAltWb, 0.26576288851424545], // C43
      [result.value.pmFluxRefWb, 0.26576288851424557], // C44
      [result.value.backEmfPeakLineLineV, 520.6038028821229], // C39
      [result.value.backEmfPeakLineLineVPerHz, 2.892243349345127], // C40
      [result.value.backEmfRmsLineLineV, 368.12247932945377], // C41
      [result.value.backEmfRmsLineLineVPerHz, 2.045124885163632], // C42
      [result.value.rsAverageOhmPerPhase, 0.33], // C64
      [result.value.lqAverageMh, 8.588162794114616], // C68
      [result.value.ldAverageMh, 6.6000000000000005], // C73
      [result.value.pmFluxAverageWb, 0.26576288851424557], // C78
      [result.value.supplyPhasePeakV, 375.588427226754], // C45
      [result.value.vqPeakV, 306.03102429945903], // C52
      [result.value.voltageDPeakV, 205.84765229075342], // C53
      [result.value.voltageVectorPeakV, 368.82006966458727], // C54
    ]
    const maxAbsoluteDifference = Math.max(...excelExample.map(([actual, expected]) => Math.abs(actual - expected)))
    expect(maxAbsoluteDifference).toBeLessThan(1e-8)
    const { constantTorque, outputCurrent, intersection, currentLimit, maximumTorque } = result.value.operatingCurves
    const atNegative23 = constantTorque.find((point) => Math.abs(point.x - (-23)) < 1e-10)
    const outputAtNegative23 = outputCurrent.find((point) => Math.abs(point.x - (-23)) < 1e-10)
    expect(atNegative23?.y).toBeCloseTo(14.100, 2)
    expect(outputAtNegative23?.y).toBeCloseTo(26.980, 2)
    expect(intersection?.idA).toBeCloseTo(-1.9702386669478849, 2) // I75 (Excel approximate VLOOKUP lookup)
    expect(intersection?.iqA).toBeCloseTo(16.30095286854715, 2) // I76
    expect(intersection?.currentLimitA).toBeCloseTo(16.419589057809336, 2) // I77
    expect(constantTorque).toHaveLength(1231) // -23..100 in 0.1 A increments
    expect(maximumTorque).toHaveLength(601) // Iq 0..60 in 0.1 A increments
    expect(currentLimit).toHaveLength(601) // Id -30..30 in 0.1 A increments
    expect(currentLimit.some((point) => point.y === null)).toBe(true)
  })
})
