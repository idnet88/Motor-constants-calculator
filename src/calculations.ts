export type InductionInputs = {
  powerW: number
  poles: number
  frequencyHz: number
  ratedSpeedRpm: number
  ratedVoltageV: number
  ratedCurrentA: number
  efficiency: number
  idFloor: number
  fieldWeakeningStart: number
  voltageHeadroom: number
  lineResistanceOhm: number
  loadFactor: number
  sweepHz: number[]
}

export type SynchronousInputs = {
  powerW: number
  poles: number
  frequencyHz: number
  ratedVoltageV: number
  ratedCurrentA: number
  lineResistanceOhm: number
  lqTunedMh: number
  ldTunedMh: number
}

export type Result<T> = { ok: true; value: T } | { ok: false; issues: string[] }

export type FrequencyPoint = {
  frequencyHz: number
  idBeforeA: number
  iqBeforeA: number
  vdBeforeV: number
  vqBeforeV: number
  peakBeforeV: number
  lineRmsBeforeV: number
  idNoLimitA: number
  idAfterA: number
  iqAfterA: number
  rmsCurrentAfterA: number
  vdAfterV: number
  vqAfterV: number
  peakAfterV: number
  lineRmsAfterV: number
}

export type InductionResults = {
  powerKw: number
  powerHp: number
  synchronousSpeedRpm: number
  slipRpm: number
  slipHz: number
  slipRatio: number
  torqueNm: number
  torqueLbfIn: number
  torqueLbfFt: number
  torqueKgfM: number
  powerFactor: number
  powerFactorAngleDeg: number
  noLoadCurrentLowA: number
  noLoadCurrentHighA: number
  noLoadCurrentMinA: number
  noLoadCurrentAverageA: number
  noLoadCurrentMaxA: number
  angularSpeedRadS: number
  wrOverW: number
  apparentPowerVa: number
  activePowerW: number
  reactivePowerVar: number
  dcLinkVoltageV: number
  vdsV: number
  didtMin: number
  didtMax: number
  angleOneDeg: number
  phaseCurrentOneA: number
  dCurrentOneA: number
  qCurrentOneA: number
  rotorDCurrentOneA: number
  rotorQCurrentOneA: number
  ratedCurrentOneA: number
  angleTwoDeg: number
  phaseCurrentTwoA: number
  dCurrentTwoA: number
  qCurrentTwoA: number
  rotorDCurrentTwoA: number
  rotorQCurrentTwoA: number
  ratedCurrentTwoA: number
  iqPeakA: number
  idPeakA: number
  idFloorA: number
  vdV: number
  magnetizingInductanceMh: number
  fieldWeakeningStartHz: number
  voltageLimitPeakPerPhaseV: number
  rsMinOhm: number
  rsAverageOhm: number
  rsMaxOhm: number
  leakageMinMh: number
  leakageAverageMh: number
  leakageMaxMh: number
  magnetizingMinMh: number
  magnetizingAverageMh: number
  magnetizingMaxMh: number
  statorMinMh: number
  statorAverageMh: number
  statorMaxMh: number
  rotorTimeMinMs: number
  rotorTimeAverageMs: number
  rotorTimeMaxMs: number
  points: FrequencyPoint[]
}

export type LqCandidate = { angleDeg: number; vqComponentV: number; voltagePeakV: number; lqMh: number; allowed: boolean }

export type OperatingPoint = { x: number; y: number | null }
export type IpmOperatingCurves = {
  constantTorque: OperatingPoint[]
  maximumTorque: OperatingPoint[]
  currentLimit: OperatingPoint[]
  outputCurrent: OperatingPoint[]
  intersection: { idA: number; iqA: number; currentLimitA: number } | null
}

export type SynchronousResults = {
  powerKw: number
  powerHp: number
  synchronousSpeedRpm: number
  torqueNm: number
  torqueLbfIn: number
  torqueLbfFt: number
  torqueKgfM: number
  ktNmPerArms: number
  ktNmPerApeak: number
  kePeakLineLineVPerKrpm: number
  kePeakPhaseVPerKrpm: number
  keRmsLineLineVPerKrpm: number
  keRmsPhaseVPerKrpm: number
  backEmfPeakLineLineV: number
  backEmfPeakLineLineVPerHz: number
  backEmfRmsLineLineV: number
  backEmfRmsLineLineVPerHz: number
  pmFluxRefWb: number
  pmFluxRefAltWb: number
  supplyPhasePeakV: number
  backEmfPhasePeakV: number
  ratedCurrentPeakA: number
  electricalSpeedRadS: number
  mechanicalSpeedRadS: number
  inductanceVoltageV: number
  lqReferenceMh: number
  vqPeakV: number
  voltageDPeakV: number
  voltageVectorPeakV: number
  voltageRmsV: number
  voltageAngleDeg: number
  rsMinOhmPerPhase: number
  rsAverageOhmPerPhase: number
  rsMaxOhmPerPhase: number
  lqMinMh: number
  lqAverageMh: number
  lqMaxMh: number
  lqTunedMh: number
  ldMinMh: number
  ldAverageMh: number
  ldMaxMh: number
  ldTunedMh: number
  saliencyRatio: number
  pmFluxMinWb: number
  pmFluxAverageWb: number
  pmFluxMaxWb: number
  lqCandidates: LqCandidate[]
  operatingCurves: IpmOperatingCurves
}

function ipmOperatingCurves(torqueNm: number, poles: number, lqMh: number, ldMh: number, fluxWb: number): IpmOperatingCurves {
  const deltaL = (ldMh - lqMh) / 1000
  const torqueFactor = 1.5 * (poles / 2)
  const mtpaId = (iq: number) => {
    if (deltaL === 0) return 0
    return (-fluxWb + Math.sqrt(fluxWb ** 2 + 4 * deltaL ** 2 * iq ** 2)) / (2 * deltaL)
  }
  const torqueDifference = (iq: number) => torqueFactor * iq * (fluxWb + deltaL * mtpaId(iq)) - torqueNm
  let crossing: { idA: number; iqA: number; currentLimitA: number } | null = null
  let lowerIq = 0
  let lowerError = torqueDifference(lowerIq)
  for (let index = 1; index <= 600; index += 1) {
    const upperIq = index / 10
    const upperError = torqueDifference(upperIq)
    if (Number.isFinite(lowerError) && Number.isFinite(upperError) && lowerError * upperError <= 0) {
      let lo = lowerIq
      let hi = upperIq
      let loError = lowerError
      for (let iteration = 0; iteration < 60; iteration += 1) {
        const mid = (lo + hi) / 2
        const midError = torqueDifference(mid)
        if (loError * midError <= 0) hi = mid
        else { lo = mid; loError = midError }
      }
      const iqA = (lo + hi) / 2
      const idA = mtpaId(iqA)
      const currentLimitA = Math.hypot(idA, iqA)
      if ([idA, iqA, currentLimitA].every(Number.isFinite)) crossing = { idA, iqA, currentLimitA }
      break
    }
    lowerIq = upperIq
    lowerError = upperError
  }

  const constantTorque: OperatingPoint[] = Array.from({ length: 1231 }, (_, index) => {
    const idA = -23 + index / 10
    const denominator = torqueFactor * (fluxWb + deltaL * idA)
    const iqA = denominator === 0 ? null : torqueNm / denominator
    return { x: idA, y: iqA !== null && Number.isFinite(iqA) ? iqA : null }
  })
  const maximumTorque: OperatingPoint[] = Array.from({ length: 601 }, (_, index) => {
    const iqA = index / 10
    const idA = mtpaId(iqA)
    return { x: Number.isFinite(idA) ? idA : Number.NaN, y: Number.isFinite(idA) ? iqA : null }
  })
  const currentLimit: OperatingPoint[] = Array.from({ length: 601 }, (_, index) => {
    const idA = -30 + index / 10
    const radicand = crossing ? crossing.currentLimitA ** 2 - Math.abs(idA) ** 2 : -1
    return { x: idA, y: radicand >= 0 ? Math.sqrt(radicand) : null }
  })
  const outputCurrent = constantTorque.map(({ x, y }) => ({ x, y: y === null ? null : Math.hypot(x, y) }))
  return { constantTorque, maximumTorque, currentLimit, outputCurrent, intersection: crossing }
}

class ExcelCalculationError extends Error {}

function divide(a: number, b: number, cell: string): number {
  if (!Number.isFinite(a) || !Number.isFinite(b)) throw new ExcelCalculationError(`${cell}: 유한한 숫자가 필요합니다.`)
  if (b === 0) throw new ExcelCalculationError(`${cell}: 0으로 나눌 수 없습니다.`)
  return a / b
}

function root(value: number, cell: string): number {
  if (!Number.isFinite(value) || value < 0) throw new ExcelCalculationError(`${cell}: 제곱근 계산 범위 밖의 값입니다.`)
  return Math.sqrt(value)
}

function average(a: number, b: number): number {
  return (a + b) / 2
}

function radians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

function acosDegrees(value: number, cell: string): number {
  if (value < -1 || value > 1) throw new ExcelCalculationError(`${cell}: ACOS 입력이 -1~1 범위를 벗어났습니다.`)
  return (Math.acos(value) * 180) / Math.PI
}

function finiteInputs(input: object): string[] {
  const labels: Record<string, string> = {
    powerW: '모터 용량', poles: '극수', frequencyHz: '주파수', ratedSpeedRpm: '정격 속도',
    ratedVoltageV: '정격 전압', ratedCurrentA: '정격 전류', efficiency: '효율', idFloor: 'Id 하한',
    fieldWeakeningStart: '약계자 시작', voltageHeadroom: '전압 여유', lineResistanceOhm: '선간 저항',
    loadFactor: '부하', lqTunedMh: 'Lq 최종 튜닝값', ldTunedMh: 'Ld 최종 튜닝값',
  }
  return Object.entries(input)
    .filter(([, value]) => typeof value === 'number' && !Number.isFinite(value))
    .map(([key]) => `${labels[key] ?? key} 입력값이 유효한 숫자가 아닙니다.`)
}

function positiveIssues(fields: Array<[string, number]>): string[] {
  return fields.filter(([, value]) => value <= 0).map(([label]) => `${label}은(는) 0보다 커야 합니다.`)
}

function result<T>(work: () => T): Result<T> {
  try {
    return { ok: true, value: work() }
  } catch (error) {
    return { ok: false, issues: [error instanceof Error ? error.message : '계산 중 알 수 없는 오류가 발생했습니다.'] }
  }
}

export function calculateInduction(input: InductionInputs): Result<InductionResults> {
  const issues = finiteInputs(input)
  issues.push(...positiveIssues([
    ['모터 용량', input.powerW], ['극수', input.poles], ['주파수', input.frequencyHz],
    ['정격 속도', input.ratedSpeedRpm], ['정격 전압', input.ratedVoltageV], ['정격 전류', input.ratedCurrentA],
  ]))
  if (input.efficiency <= 0 || input.efficiency > 1) issues.push('효율은 0% 초과, 100% 이하여야 합니다.')
  if (input.idFloor < 0 || input.idFloor > 1) issues.push('Id 하한은 0%~100% 범위로 입력하세요.')
  if (input.fieldWeakeningStart <= 0) issues.push('약계자 시작은 0%보다 커야 합니다.')
  if (input.voltageHeadroom < 0 || input.voltageHeadroom >= 0.99) issues.push('전압 여유는 0% 이상, 99% 미만으로 입력하세요.')
  if (input.lineResistanceOhm < 0) issues.push('선간 저항은 0 이상이어야 합니다.')
  if (input.loadFactor < 0) issues.push('부하는 0 이상이어야 합니다.')
  if (!Number.isInteger(input.poles)) issues.push('극수는 정수로 입력하세요.')
  else if (input.poles % 2 !== 0) issues.push('극수는 짝수여야 합니다.')
  if (input.sweepHz.length !== 24 || input.sweepHz.some((v) => !Number.isFinite(v) || v <= 0)) issues.push('주파수 계산점 24개를 모두 양수로 입력하세요.')
  if (issues.length) return { ok: false, issues }

  return result(() => {
    const { powerW: p, poles, frequencyHz: f, ratedSpeedRpm: nr, ratedVoltageV: v, ratedCurrentA: ir, efficiency: eta } = input
    const powerKw = p / 1000
    const powerHp = p / 746
    const synchronousSpeedRpm = (120 * f) / poles
    const slipRpm = synchronousSpeedRpm - nr
    const slipHz = (slipRpm * poles) / 120
    const slipRatio = divide(slipRpm, synchronousSpeedRpm, 'C15')
    const torqueNm = divide(p * poles, 4 * Math.PI * (f - slipHz), 'C16')
    const torqueLbfIn = torqueNm * 8.8536
    const torqueLbfFt = torqueNm * 0.73746
    const torqueKgfM = torqueNm * 0.102
    const powerFactor = divide(p, Math.sqrt(3) * v * ir * eta, 'C23')
    const powerFactorAngleDeg = acosDegrees(powerFactor, 'C24')
    const noLoadCurrentLowA = 0.3 * ir
    const noLoadCurrentHighA = 0.45 * ir
    const angularSpeedRadS = 2 * Math.PI * f
    const activePowerW = p / eta
    const apparentPowerVa = divide(activePowerW, Math.cos(radians(powerFactorAngleDeg)), 'C32')
    const wrOverW = divide(apparentPowerVa * Math.sin(radians(powerFactorAngleDeg)), activePowerW, 'C31')
    const reactivePowerVar = apparentPowerVa * Math.sin(radians(powerFactorAngleDeg))
    const dcLinkVoltageV = v * Math.SQRT2
    const vdsV = dcLinkVoltageV * (2 / 3)
    const didtMin = (ir * 2 * Math.SQRT2) / (1000 * 10 ** -6)
    const didtMax = (ir * 2 * Math.SQRT2) / (500 * 10 ** -6)
    const angleOneDeg = p <= 1500 ? 7 : p <= 11000 ? 6 : p < 22000 ? 5 : p < 75000 ? 4 : p <= 90000 ? 3 : 2
    const phaseCurrentOneA = ir * Math.sin(radians(angleOneDeg))
    const ibOne = ir * Math.sin(radians(angleOneDeg - 120))
    const icOne = ir * Math.sin(radians(angleOneDeg - 240))
    const dCurrentOneA = (2 * phaseCurrentOneA - ibOne - icOne) / 3
    const qCurrentOneA = (ibOne - icOne) / Math.sqrt(3)
    const rotorDCurrentOneA = dCurrentOneA * Math.cos(radians(angleOneDeg)) - qCurrentOneA * Math.sin(radians(angleOneDeg))
    const rotorQCurrentOneA = dCurrentOneA * Math.sin(radians(angleOneDeg)) + qCurrentOneA * Math.cos(radians(angleOneDeg))
    const ratedCurrentOneA = root(dCurrentOneA ** 2 + qCurrentOneA ** 2, 'C49')
    const angleTwoDeg = p <= 1500 ? 18 : p <= 11000 ? 12 : p < 22000 ? 10 : p < 75000 ? 10 : p <= 90000 ? 9 : 7
    const phaseCurrentTwoA = ir * Math.sin(radians(angleTwoDeg))
    const ibTwo = ir * Math.sin(radians(angleTwoDeg - 120))
    const icTwo = ir * Math.sin(radians(angleTwoDeg - 240))
    const dCurrentTwoA = (2 * phaseCurrentTwoA - ibTwo - icTwo) / 3
    const qCurrentTwoA = (ibTwo - icTwo) / Math.sqrt(3)
    const rotorDCurrentTwoA = dCurrentTwoA * Math.cos(radians(angleTwoDeg)) - qCurrentTwoA * Math.sin(radians(angleTwoDeg))
    const rotorQCurrentTwoA = dCurrentTwoA * Math.sin(radians(angleTwoDeg)) + qCurrentTwoA * Math.cos(radians(angleTwoDeg))
    const ratedCurrentTwoA = root(dCurrentTwoA ** 2 + qCurrentTwoA ** 2, 'C58')
    if (nr >= synchronousSpeedRpm) throw new ExcelCalculationError('C12: 정격 속도는 동기 속도보다 낮아야 슬립 계산이 가능합니다.')
    const voltageHeadroomFactor = (99 - input.voltageHeadroom * 100) / 100
    const voltageLimitPeakPerPhaseV = (Math.SQRT2 * v / Math.sqrt(3)) * voltageHeadroomFactor
    const fieldWeakeningStartHz = f * input.fieldWeakeningStart
    const leakageMinMh = divide(vdsV, didtMax, 'C81') * 1000
    const leakageMaxMh = divide(vdsV, didtMin, 'C83') * 1000
    const leakageAverageMh = average(leakageMinMh, leakageMaxMh)
    const statorMinMh = divide(81 * v, f * noLoadCurrentHighA, 'C89')
    const statorMaxMh = divide(81 * v, f * noLoadCurrentLowA, 'C91')
    const statorAverageMh = average(statorMinMh, statorMaxMh)
    const magnetizingMinMh = statorMinMh - 0.5 * leakageMinMh
    const magnetizingMaxMh = statorMaxMh - 0.5 * leakageMaxMh
    const magnetizingAverageMh = average(magnetizingMinMh, magnetizingMaxMh)
    const noLoadCurrentCalcA = divide(v, Math.sqrt(3) * 2 * Math.PI * f * magnetizingMaxMh, 'C29') * 1000
    const noLoadCurrentMinA = Math.max(noLoadCurrentLowA, noLoadCurrentCalcA)
    const noLoadCurrentMaxA = Math.max(noLoadCurrentHighA, noLoadCurrentCalcA)
    const noLoadCurrentAverageA = average(noLoadCurrentMinA, noLoadCurrentMaxA)
    const iqPeakA = root(ir ** 2 - noLoadCurrentAverageA ** 2, 'C59') * Math.SQRT2
    const idPeakA = noLoadCurrentAverageA * Math.SQRT2 * input.fieldWeakeningStart
    const idFloorA = idPeakA * input.idFloor
    const vdV = input.lineResistanceOhm * idPeakA
    const rsMinOhm = input.lineResistanceOhm * 0.4
    const rsAverageOhm = average(rsMinOhm, input.lineResistanceOhm * 0.6)
    const rsMaxOhm = input.lineResistanceOhm * 0.6
    const magnetizingInductanceMh = (statorAverageMh / 1000) - 0.5 * (leakageAverageMh / 1000)
    const base = { rsAverageOhm, magnetizingInductanceMh, iqPeakA, idPeakA, idFloorA, vdV, noLoadCurrentAverageA, voltageLimitPeakPerPhaseV }
    const frequencies = [slipHz, ...input.sweepHz]
    const points = frequencies.map((frequencyHz): FrequencyPoint => {
      const idBeforeA = base.idPeakA * input.fieldWeakeningStart
      const iqBeforeA = divide(base.iqPeakA, input.fieldWeakeningStart, 'H102') * input.loadFactor
      const vdBeforeV = base.rsAverageOhm * idBeforeA
      const vqBeforeV = base.rsAverageOhm * iqBeforeA + 2 * Math.PI * frequencyHz * base.magnetizingInductanceMh * base.idPeakA
      const peakBeforeV = root(vdBeforeV ** 2 + vqBeforeV ** 2, 'K102')
      const lineRmsBeforeV = (peakBeforeV * Math.sqrt(3)) / Math.SQRT2
      const idNoLimitA = peakBeforeV > base.voltageLimitPeakPerPhaseV
        ? divide(base.voltageLimitPeakPerPhaseV, 2 * Math.PI * frequencyHz * base.magnetizingInductanceMh, 'N102')
        : base.noLoadCurrentAverageA * input.fieldWeakeningStart * Math.SQRT2
      const idAfterA = idNoLimitA < base.idFloorA ? base.idFloorA : idNoLimitA
      const iqAfterA = divide(idBeforeA * iqBeforeA, idAfterA, 'P102')
      const rmsCurrentAfterA = root(idAfterA ** 2 + iqAfterA ** 2, 'Q102') / Math.SQRT2
      const vdAfterV = base.rsAverageOhm * idAfterA
      const vqAfterV = base.rsAverageOhm * iqAfterA + 2 * Math.PI * frequencyHz * base.magnetizingInductanceMh * idAfterA
      const voltageVector = root(vdAfterV ** 2 + vqAfterV ** 2, 'T102')
      const peakAfterV = voltageVector > base.voltageLimitPeakPerPhaseV ? base.voltageLimitPeakPerPhaseV : voltageVector
      const lineRmsAfterV = (peakAfterV * Math.sqrt(3)) / Math.SQRT2
      return { frequencyHz, idBeforeA, iqBeforeA, vdBeforeV, vqBeforeV, peakBeforeV, lineRmsBeforeV, idNoLimitA, idAfterA, iqAfterA, rmsCurrentAfterA, vdAfterV, vqAfterV, peakAfterV, lineRmsAfterV }
    })
    const rotorTimeMinMs = Math.abs(divide(rotorQCurrentTwoA, rotorDCurrentTwoA * 2 * Math.PI * slipHz, 'C93')) * 1000
    const rotorTimeMaxMs = Math.abs(divide(rotorQCurrentOneA, rotorDCurrentOneA * 2 * Math.PI * slipHz, 'C95')) * 1000
    return {
      powerKw, powerHp, synchronousSpeedRpm, slipRpm, slipHz, slipRatio, torqueNm, torqueLbfIn, torqueLbfFt, torqueKgfM,
      powerFactor, powerFactorAngleDeg, noLoadCurrentLowA, noLoadCurrentHighA,
      noLoadCurrentMinA, noLoadCurrentAverageA, noLoadCurrentMaxA,
      angularSpeedRadS, wrOverW, apparentPowerVa, activePowerW, reactivePowerVar, dcLinkVoltageV, vdsV, didtMin, didtMax,
      angleOneDeg, phaseCurrentOneA, dCurrentOneA, qCurrentOneA, rotorDCurrentOneA, rotorQCurrentOneA, ratedCurrentOneA,
      angleTwoDeg, phaseCurrentTwoA, dCurrentTwoA, qCurrentTwoA, rotorDCurrentTwoA, rotorQCurrentTwoA, ratedCurrentTwoA,
      iqPeakA, idPeakA, idFloorA, vdV, magnetizingInductanceMh,
      fieldWeakeningStartHz, voltageLimitPeakPerPhaseV, rsMinOhm, rsAverageOhm, rsMaxOhm,
      leakageMinMh, leakageAverageMh, leakageMaxMh, magnetizingMinMh, magnetizingAverageMh, magnetizingMaxMh,
      statorMinMh, statorAverageMh, statorMaxMh: statorMaxMh, rotorTimeMinMs,
      rotorTimeAverageMs: average(rotorTimeMinMs, rotorTimeMaxMs), rotorTimeMaxMs, points,
    }
  })
}

export function calculateSynchronous(input: SynchronousInputs): Result<SynchronousResults> {
  const issues = finiteInputs(input)
  issues.push(...positiveIssues([
    ['모터 용량', input.powerW], ['극수', input.poles], ['주파수', input.frequencyHz],
    ['정격 전압', input.ratedVoltageV], ['정격 전류', input.ratedCurrentA], ['Lq 최종 튜닝값', input.lqTunedMh], ['Ld 최종 튜닝값', input.ldTunedMh],
  ]))
  if (input.lineResistanceOhm < 0) issues.push('선간 저항은 0 이상이어야 합니다.')
  if (!Number.isInteger(input.poles)) issues.push('극수는 정수로 입력하세요.')
  else if (input.poles % 2 !== 0) issues.push('극수는 짝수여야 합니다.')
  if (issues.length) return { ok: false, issues }

  return result(() => {
    const { powerW: p, poles, frequencyHz: f, ratedVoltageV: v, ratedCurrentA: ir, lineResistanceOhm: r, lqTunedMh: lq, ldTunedMh: ld } = input
    const powerKw = p / 1000
    const powerHp = p / 746
    const synchronousSpeedRpm = (f * 120) / poles
    const torqueNm = divide(p * poles, 4 * Math.PI * f, 'C12')
    const torqueLbfIn = torqueNm * 8.8536
    const torqueLbfFt = torqueNm * 0.73746
    const torqueKgfM = torqueNm * 0.102
    const ratedCurrentPeakA = ir * Math.SQRT2
    const ktNmPerArms = divide(torqueNm, ir, 'C16')
    const ktNmPerApeak = divide(torqueNm, ratedCurrentPeakA, 'C17')
    const keRmsLineLineVPerKrpm = (ktNmPerArms / Math.sqrt(3)) * ((2 * Math.PI) / 60) * 1000
    const kePeakLineLineVPerKrpm = keRmsLineLineVPerKrpm * Math.SQRT2
    const kePeakPhaseVPerKrpm = kePeakLineLineVPerKrpm / Math.sqrt(3)
    const keRmsPhaseVPerKrpm = keRmsLineLineVPerKrpm / Math.sqrt(3)
    const backEmfPeakLineLineV = kePeakLineLineVPerKrpm * synchronousSpeedRpm / 1000
    const backEmfPeakLineLineVPerHz = divide(backEmfPeakLineLineV, f, 'C23')
    const backEmfRmsLineLineV = backEmfPeakLineLineV / Math.SQRT2
    const backEmfRmsLineLineVPerHz = divide(backEmfRmsLineLineV, f, 'C25')
    const pmFluxRefWb = divide(backEmfPeakLineLineVPerHz, Math.sqrt(3) * 2 * Math.PI, 'C27')
    const pmFluxRefAltWb = (ktNmPerApeak / 1.5) * 2 / poles
    const supplyPhasePeakV = (v * Math.SQRT2) / Math.sqrt(3)
    const backEmfPhasePeakV = backEmfPeakLineLineV / Math.sqrt(3)
    const electricalSpeedRadS = 2 * Math.PI * f
    const mechanicalSpeedRadS = electricalSpeedRadS / (poles / 2)
    const inductanceVoltageV = root(supplyPhasePeakV ** 2 - backEmfPhasePeakV ** 2, 'C33')
    const lqReferenceMh = divide(inductanceVoltageV, electricalSpeedRadS * ratedCurrentPeakA, 'C34') * 1000
    const rsMinOhmPerPhase = r * 0.5
    const rsMaxOhmPerPhase = r * 0.7
    const rsAverageOhmPerPhase = average(rsMinOhmPerPhase, rsMaxOhmPerPhase)
    const vqPeakV = rsAverageOhmPerPhase * ratedCurrentPeakA + electricalSpeedRadS * pmFluxRefWb
    const voltageDPeakV = electricalSpeedRadS * ratedCurrentPeakA * lq / 1000
    const voltageVectorPeakV = root(vqPeakV ** 2 + voltageDPeakV ** 2, 'C37')
    const voltageRmsV = (voltageVectorPeakV / Math.SQRT2) * Math.sqrt(3)
    const voltageAngleDeg = (Math.atan(divide(voltageDPeakV, vqPeakV, 'C39')) * 180) / Math.PI
    const lqCandidates = Array.from({ length: 51 }, (_, angleDeg): LqCandidate => {
      const vqComponentV = vqPeakV * Math.tan(radians(angleDeg))
      const voltagePeakV = root(vqPeakV ** 2 + vqComponentV ** 2, `C${726 + angleDeg}`)
      const allowed = vqComponentV >= vqPeakV * 0.7 || voltagePeakV >= supplyPhasePeakV
      const lqMh = divide(vqComponentV, electricalSpeedRadS * ratedCurrentPeakA, `C${778 + angleDeg}`) * 1000
      return { angleDeg, vqComponentV, voltagePeakV, lqMh, allowed }
    })
    const validLq = lqCandidates.filter((candidate) => candidate.allowed).map((candidate) => candidate.lqMh)
    const lqMaxMh = validLq.length ? Math.min(...validLq) : 0
    const lqMinMh = lqMaxMh / 2
    const lqAverageMh = average(lqMinMh, lqMaxMh)
    // The source workbook derives the Ld range from the Lq tuning cell; preserve that reference exactly.
    const ldMinMh = lq * 0.4
    const ldMaxMh = lq * 0.8
    const ldAverageMh = average(ldMinMh, ldMaxMh)
    const saliencyRatio = divide(lq, ld, 'C59')
    const pmFluxAverageWb = pmFluxRefWb !== 0 ? pmFluxRefWb : pmFluxRefAltWb
    const pmFluxMinWb = pmFluxAverageWb * 0.8
    const pmFluxMaxWb = pmFluxAverageWb * 1.2
    const operatingCurves = ipmOperatingCurves(torqueNm, poles, lq, ld, pmFluxAverageWb)
    return {
      powerKw, powerHp, synchronousSpeedRpm, torqueNm, torqueLbfIn, torqueLbfFt, torqueKgfM,
      ktNmPerArms, ktNmPerApeak, kePeakLineLineVPerKrpm, kePeakPhaseVPerKrpm, keRmsLineLineVPerKrpm, keRmsPhaseVPerKrpm,
      backEmfPeakLineLineV, backEmfPeakLineLineVPerHz, backEmfRmsLineLineV, backEmfRmsLineLineVPerHz,
      pmFluxRefWb, pmFluxRefAltWb, supplyPhasePeakV, backEmfPhasePeakV, ratedCurrentPeakA, electricalSpeedRadS,
      mechanicalSpeedRadS, inductanceVoltageV, lqReferenceMh, vqPeakV, voltageDPeakV, voltageVectorPeakV, voltageRmsV, voltageAngleDeg,
      rsMinOhmPerPhase, rsAverageOhmPerPhase, rsMaxOhmPerPhase, lqMinMh, lqAverageMh, lqMaxMh, lqTunedMh: lq,
      ldMinMh, ldAverageMh, ldMaxMh, ldTunedMh: ld, saliencyRatio,
      pmFluxMinWb, pmFluxAverageWb, pmFluxMaxWb, lqCandidates, operatingCurves,
    }
  })
}
