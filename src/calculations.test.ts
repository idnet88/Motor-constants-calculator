import { describe, expect, it } from 'vitest'
import { calculateInduction, calculateSynchronous } from './calculations'

const inductionInput = {
  powerW: 7500,
  poles: 4,
  frequencyHz: 60,
  ratedSpeedRpm: 1750,
  ratedVoltageV: 460,
  ratedCurrentA: 14,
  efficiency: 0.92,
  idFloor: 0.5,
  fieldWeakeningStart: 1,
  voltageHeadroom: 0.05,
  lineResistanceOhm: 0.5,
  loadFactor: 1,
  sweepHz: Array.from({ length: 24 }, (_, index) => (index + 1) * 5),
}

const synchronousInput = {
  powerW: 5000,
  poles: 4,
  frequencyHz: 60,
  ratedVoltageV: 220,
  ratedCurrentA: 20,
  lineResistanceOhm: 0.2,
  lqTunedMh: 1,
  ldTunedMh: 0.8,
}

describe('motor constant calculation engines', () => {
  it('derives induction speed, slip, torque, and frequency response from one result', () => {
    const result = calculateInduction(inductionInput)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.synchronousSpeedRpm).toBe(1800)
    expect(result.value.slipRpm).toBe(50)
    expect(result.value.slipHz).toBeCloseTo(5 / 3, 10)
    expect(result.value.torqueNm).toBeCloseTo(40.929, 2)
    expect(result.value.points).toHaveLength(25)
    expect(result.value.points[0].frequencyHz).toBeCloseTo(5 / 3, 10)
    expect(result.value.points.at(-1)?.frequencyHz).toBe(120)
    expect(result.value.points.at(-1)?.lineRmsAfterV).toBeCloseTo(
      ((result.value.points.at(-1)?.peakAfterV ?? 0) * Math.sqrt(3)) / Math.sqrt(2),
      10,
    )
  })

  it('keeps zero-input Excel errors out of successful results', () => {
    const result = calculateInduction({
      ...inductionInput,
      powerW: 0,
      poles: 0,
      frequencyHz: 0,
      ratedSpeedRpm: 0,
      ratedVoltageV: 0,
      ratedCurrentA: 0,
      efficiency: 0,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues.length).toBeGreaterThan(3)
  })

  it('rejects odd pole counts for both motor types', () => {
    const induction = calculateInduction({ ...inductionInput, poles: 3 })
    const synchronous = calculateSynchronous({ ...synchronousInput, poles: 3 })
    expect(induction.ok).toBe(false)
    if (!induction.ok) expect(induction.issues).toContain('극수는 짝수여야 합니다.')
    expect(synchronous.ok).toBe(false)
    if (!synchronous.ok) expect(synchronous.issues).toContain('극수는 짝수여야 합니다.')
  })

  it('applies synchronous candidate filters and DMIN minimum selection', () => {
    const result = calculateSynchronous(synchronousInput)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.synchronousSpeedRpm).toBe(1800)
    expect(result.value.torqueNm).toBeCloseTo((5000 * 4) / (4 * Math.PI * 60), 10)
    expect(result.value.lqCandidates).toHaveLength(51)
    const accepted = result.value.lqCandidates.filter((candidate) => candidate.allowed)
    expect(accepted.length).toBeGreaterThan(0)
    expect(result.value.lqMaxMh).toBeCloseTo(Math.min(...accepted.map((candidate) => candidate.lqMh)), 12)
  })

  it('handles the SPM case without dividing by zero in the MTPA curve', () => {
    const result = calculateSynchronous({ ...synchronousInput, lqTunedMh: 1.2, ldTunedMh: 1.2 })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.operatingCurves.maximumTorque).toHaveLength(601)
    expect(result.value.operatingCurves.maximumTorque.every((point) => point.x === 0)).toBe(true)
    expect(result.value.operatingCurves.intersection?.idA).toBe(0)
    expect(result.value.operatingCurves.currentLimit.some((point) => point.y === null)).toBe(true)
    for (const points of Object.values(result.value.operatingCurves).filter(Array.isArray) as Array<Array<{ x: number; y: number | null }>>) {
      expect(points.every((point) => Number.isFinite(point.x) && (point.y === null || Number.isFinite(point.y)))).toBe(true)
    }
  })
})
