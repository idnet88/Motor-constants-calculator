import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { LabelList, Line, LineChart, CartesianGrid, Legend, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { tr, type Locale } from './i18n'
import {
  calculateInduction,
  calculateSynchronous,
  type InductionInputs,
  type InductionResults,
  type IpmOperatingCurves,
  type OperatingPoint,
  type SynchronousInputs,
  type SynchronousResults,
} from './calculations'

type Mode = 'induction' | 'synchronous'
type FieldProps = { label: string; cell: string; unit: string; value: number; step?: number; min?: number; max?: number; displayScale?: number; onChange: (next: number) => void }

const initialInduction: InductionInputs = {
  powerW: 0,
  poles: 0,
  frequencyHz: 0,
  ratedSpeedRpm: 0,
  ratedVoltageV: 0,
  ratedCurrentA: 0,
  efficiency: 0,
  idFloor: 0.5,
  fieldWeakeningStart: 1,
  voltageHeadroom: 0.05,
  lineResistanceOhm: 0,
  loadFactor: 1,
  sweepHz: Array.from({ length: 24 }, (_, index) => (index + 1) * 5),
}

const initialSynchronous: SynchronousInputs = {
  powerW: 0,
  poles: 0,
  frequencyHz: 0,
  ratedVoltageV: 0,
  ratedCurrentA: 0,
  lineResistanceOhm: 0,
  lqTunedMh: 1,
  ldTunedMh: 0.8,
}

function NumberField({ label, cell, unit, value, step = 0.01, min, max, displayScale = 1, onChange }: FieldProps) {
  return (
    <label className="field">
      <span className="field-copy"><span>{label}</span><small>{cell}</small></span>
      <span className="field-control">
        <input
          type="number"
          inputMode="decimal"
          value={Number.isFinite(value) ? value * displayScale : ''}
          step={step}
          min={min}
          max={max}
          onChange={(event) => onChange(event.currentTarget.value === '' ? Number.NaN : event.currentTarget.valueAsNumber / displayScale)}
          aria-label={`${label} (${unit})`}
        />
        <span className="unit">{unit}</span>
      </span>
    </label>
  )
}

function format(value: number, digits = 3) {
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(value)
}

function FieldSection({ title, children, note, locale }: { title: string; children: ReactNode; note?: string; locale: Locale }) {
  return <section className="field-section"><div className="section-heading"><h3>{tr(locale, title)}</h3>{note && <p>{tr(locale, note)}</p>}</div><div className="field-grid">{children}</div></section>
}

function Metric({ label, value, unit, source, tone = '' }: { label: string; value: string; unit: string; source: string; tone?: string }) {
  return <div className={`metric ${tone}`}><div className="metric-top"><span>{label}</span><small>{source}</small></div><strong>{value}<em>{unit}</em></strong></div>
}

type ConstantCardProps = {
  label: string
  minimum: number
  average: number
  maximum: number
  unit: string
  minCell: string
  averageCell: string
  maxCell: string
  description: string
  formula: string
  process: string
}

function ConstantCard({ label, minimum, average, maximum, unit, minCell, averageCell, maxCell, description, formula, process, locale }: ConstantCardProps & { locale: Locale }) {
  return <details className="constant-card" data-constant={label}>
    <summary>
      <span className="constant-label">{tr(locale, label)}<small>{minCell} · {averageCell} · {maxCell}</small></span>
      <span className="constant-range">
        <span><small>{tr(locale, '최소')} · {minCell}</small><strong data-stat="minimum">{Number.isFinite(minimum) ? format(minimum, 4) : tr(locale, '계산 오류')}<em>{unit}</em></strong></span>
        <span><small>{tr(locale, '평균')} · {averageCell}</small><strong data-stat="average">{Number.isFinite(average) ? format(average, 4) : tr(locale, '계산 오류')}<em>{unit}</em></strong></span>
        <span><small>{tr(locale, '최대')} · {maxCell}</small><strong data-stat="maximum">{Number.isFinite(maximum) ? format(maximum, 4) : tr(locale, '계산 오류')}<em>{unit}</em></strong></span>
      </span>
      <span className="constant-description">{tr(locale, description)}</span>
      <span className="constant-hint">{tr(locale, '계산식과 과정 보기')} <i>+</i></span>
    </summary>
    <div className="constant-process"><b>{tr(locale, 'Excel 수식')}</b><code>{formula}</code><p>{tr(locale, process)}</p></div>
  </details>
}

function ConstantCards({ children, locale }: { children: ReactNode; locale: Locale }) {
  return <section className="constant-results" aria-label={tr(locale, '주요 모터 상수 결과')}><div className="constant-heading"><h3>{tr(locale, '주요 모터 상수')}</h3><span>{tr(locale, '각 카드를 열어 셀 수식과 계산 흐름을 확인할 수 있습니다.')}</span></div><div className="constant-grid">{children}</div></section>
}

type ResultRow<T> = { label: string; cell: string; unit: string; read: (result: T) => number }
type ResultGroup<T> = { title: string; rows: ResultRow<T>[] }

function ResultTable<T>({ groups, result, locale }: { groups: ResultGroup<T>[]; result: T; locale: Locale }) {
  return <div className="result-groups">{groups.map((group) => <section className="result-group" key={group.title}>
    <h3>{tr(locale, group.title)}</h3>
    {group.rows.map((row) => <div className="result-row" key={row.cell}>
      <span>{tr(locale, row.label)}<small>{row.cell}</small></span><b>{format(row.read(result))}<em>{row.unit}</em></b>
    </div>)}
  </section>)}</div>
}

function mailInputRows(rows: Array<[string, number, string]>, locale: Locale) {
  return rows.map(([label, value, unit]) => `- ${tr(locale, label)}: ${format(value, 4)} ${unit}`).join('\n')
}

function mailRange(label: string, minimum: number, average: number, maximum: number, unit: string, locale: Locale) {
  return `${tr(locale, label)}: ${tr(locale, '최소')} ${format(minimum, 4)} ${unit} | ${tr(locale, '평균')} ${format(average, 4)} ${unit} | ${tr(locale, '최대')} ${format(maximum, 4)} ${unit}`
}

function makeInductionReport(result: InductionResults, input: InductionInputs, locale: Locale) {
  const inputs = mailInputRows([
    ['모터 용량', input.powerW, 'W'], ['극수', input.poles, tr(locale, '극')], ['주파수', input.frequencyHz, 'Hz'], ['정격 속도', input.ratedSpeedRpm, 'rpm'],
    ['정격 전압', input.ratedVoltageV, 'V'], ['정격 전류', input.ratedCurrentA, 'A'], ['효율', input.efficiency * 100, '%'], ['선간 저항', input.lineResistanceOhm, 'Ω'],
    ['Id 하한', input.idFloor * 100, '%'], ['약계자 시작', input.fieldWeakeningStart * 100, '%'], ['전압 여유', input.voltageHeadroom * 100, '%'], ['부하', input.loadFactor * 100, '%'],
  ], locale)
  const ranges = [
    mailRange('Rs', result.rsMinOhm, result.rsAverageOhm, result.rsMaxOhm, 'Ω', locale),
    mailRange('무부하 전류', result.noLoadCurrentMinA, result.noLoadCurrentAverageA, result.noLoadCurrentMaxA, 'A', locale),
    mailRange('Lσ', result.leakageMinMh, result.leakageAverageMh, result.leakageMaxMh, 'mH', locale),
    mailRange('Ls', result.statorMinMh, result.statorAverageMh, result.statorMaxMh, 'mH', locale),
    mailRange('Tr', result.rotorTimeMinMs, result.rotorTimeAverageMs, result.rotorTimeMaxMs, 'ms', locale),
    mailRange('Lm', result.magnetizingMinMh, result.magnetizingAverageMh, result.magnetizingMaxMh, 'mH', locale),
  ].join('\n')
  const frequencies = result.points.map((point) => `${format(point.frequencyHz, 2)} Hz | Vd ${format(point.vdAfterV, 3)} V | Vq ${format(point.vqAfterV, 3)} V | Vrms ${format(point.lineRmsAfterV, 3)} V | Id ${format(point.idAfterA, 3)} A | Iq ${format(point.iqAfterA, 3)} A | Irms ${format(point.rmsCurrentAfterA, 3)} A`).join('\n')
  return `${tr(locale, '유도기 결과 보고서')}\n\n${tr(locale, '입력 조건')}\n${inputs}\n\n${tr(locale, '주요 결과')}\n${ranges}\n\n${tr(locale, '주파수 응답 데이터')}\n${tr(locale, '주파수 (Hz)')} | ${tr(locale, '전압 Vd (V)')} | ${tr(locale, '전압 Vq (V)')} | ${tr(locale, '선간 실효 전압 (V)')} | ${tr(locale, '전류 Id (A)')} | ${tr(locale, '전류 Iq (A)')} | ${tr(locale, '실효 전류 (A)')}\n${frequencies}\n\n${tr(locale, '결과는 Excel 원본 수식 구조를 따라 계산합니다.')}`
}

function makeSynchronousReport(result: SynchronousResults, input: SynchronousInputs, locale: Locale) {
  const inputs = mailInputRows([
    ['모터 용량', input.powerW, 'W'], ['극수', input.poles, tr(locale, '극')], ['동기 주파수', input.frequencyHz, 'Hz'],
    ['정격 전압', input.ratedVoltageV, 'V'], ['정격 전류', input.ratedCurrentA, 'A'], ['선간 저항', input.lineResistanceOhm, 'Ω'],
    ['Lq 최종 튜닝값', input.lqTunedMh, 'mH'], ['Ld 최종 튜닝값', input.ldTunedMh, 'mH'],
  ], locale)
  const ranges = [
    mailRange('Rs', result.rsMinOhmPerPhase, result.rsAverageOhmPerPhase, result.rsMaxOhmPerPhase, 'Ω/ph', locale),
    mailRange('Lq', result.lqMinMh, result.lqAverageMh, result.lqMaxMh, 'mH', locale),
    mailRange('Ld', result.ldMinMh, result.ldAverageMh, result.ldMaxMh, 'mH', locale),
    mailRange('PM Rotor Flux Ref', result.pmFluxMinWb, result.pmFluxAverageWb, result.pmFluxMaxWb, 'Wb', locale),
    `${tr(locale, '동기 속도')}: ${format(result.synchronousSpeedRpm)} rpm`,
    `${tr(locale, '정격 토크')}: ${format(result.torqueNm, 3)} N·m`,
  ].join('\n')
  return `${tr(locale, '동기기 결과 보고서')}\n\n${tr(locale, '입력 조건')}\n${inputs}\n\n${tr(locale, '주요 결과')}\n${ranges}\n\n${tr(locale, '결과는 Excel 원본 수식 구조를 따라 계산합니다.')}`
}

const inductionGroups: ResultGroup<InductionResults>[] = [
  { title: '정격 운전점', rows: [
    { label: '모터 용량', cell: 'C7', unit: 'kW', read: (r) => r.powerKw },
    { label: '모터 용량', cell: 'C8', unit: 'HP', read: (r) => r.powerHp },
    { label: '동기 속도', cell: 'C11', unit: 'rpm', read: (r) => r.synchronousSpeedRpm },
    { label: '슬립 속도', cell: 'C13', unit: 'rpm', read: (r) => r.slipRpm },
    { label: '슬립 주파수', cell: 'C14', unit: 'Hz', read: (r) => r.slipHz },
    { label: '슬립 비율', cell: 'C15', unit: '', read: (r) => r.slipRatio },
    { label: '토크', cell: 'C16', unit: 'N·m', read: (r) => r.torqueNm },
    { label: '토크 변환', cell: 'C17', unit: 'lbf·in', read: (r) => r.torqueLbfIn },
    { label: '토크 변환', cell: 'C18', unit: 'lbf·ft', read: (r) => r.torqueLbfFt },
    { label: '토크 변환', cell: 'C19', unit: 'kgf·m', read: (r) => r.torqueKgfM },
    { label: '역률', cell: 'C23', unit: '', read: (r) => r.powerFactor },
    { label: '역률각', cell: 'C24', unit: '°', read: (r) => r.powerFactorAngleDeg },
    { label: '각속도', cell: 'C30', unit: 'rad/s', read: (r) => r.angularSpeedRadS },
    { label: 'Wr/W', cell: 'C31', unit: '', read: (r) => r.wrOverW },
    { label: '피상 전력', cell: 'C32', unit: 'VA', read: (r) => r.apparentPowerVa },
    { label: '유효 전력', cell: 'C33', unit: 'W', read: (r) => r.activePowerW },
    { label: '무효 전력', cell: 'C34', unit: 'var', read: (r) => r.reactivePowerVar },
    { label: 'DC Link 전압', cell: 'C35', unit: 'Vdc', read: (r) => r.dcLinkVoltageV },
    { label: 'Vds', cell: 'C36', unit: 'Vdc', read: (r) => r.vdsV },
    { label: 'di/dt 최소 조건', cell: 'C38', unit: 'A/s', read: (r) => r.didtMin },
    { label: 'di/dt 최대 조건', cell: 'C39', unit: 'A/s', read: (r) => r.didtMax },
  ] },
  { title: '전류 좌표 변환', rows: [
    { label: '회전각 1', cell: 'C41', unit: '°', read: (r) => r.angleOneDeg },
    { label: '상전류', cell: 'C42', unit: 'A', read: (r) => r.phaseCurrentOneA },
    { label: 'Ids', cell: 'C45', unit: 'A', read: (r) => r.dCurrentOneA },
    { label: 'Iqs', cell: 'C46', unit: 'A', read: (r) => r.qCurrentOneA },
    { label: 'Ide', cell: 'C47', unit: 'A', read: (r) => r.rotorDCurrentOneA },
    { label: 'Iqe', cell: 'C48', unit: 'A', read: (r) => r.rotorQCurrentOneA },
    { label: '정격 전류 크기', cell: 'C49', unit: 'A', read: (r) => r.ratedCurrentOneA },
    { label: '회전각 2', cell: 'C50', unit: '°', read: (r) => r.angleTwoDeg },
    { label: '상전류', cell: 'C51', unit: 'A', read: (r) => r.phaseCurrentTwoA },
    { label: 'Ids', cell: 'C54', unit: 'A', read: (r) => r.dCurrentTwoA },
    { label: 'Iqs', cell: 'C55', unit: 'A', read: (r) => r.qCurrentTwoA },
    { label: 'Ide', cell: 'C56', unit: 'A', read: (r) => r.rotorDCurrentTwoA },
    { label: 'Iqe', cell: 'C57', unit: 'A', read: (r) => r.rotorQCurrentTwoA },
    { label: '정격 전류 크기', cell: 'C58', unit: 'A', read: (r) => r.ratedCurrentTwoA },
  ] },
  { title: '제어 파생값', rows: [
    { label: 'Iq', cell: 'C59', unit: 'A peak', read: (r) => r.iqPeakA },
    { label: 'Id', cell: 'C60', unit: 'A peak', read: (r) => r.idPeakA },
    { label: 'Id 하한 적용', cell: 'C62', unit: 'A', read: (r) => r.idFloorA },
    { label: 'Vd', cell: 'C63', unit: 'V', read: (r) => r.vdV },
    { label: 'Lm', cell: 'C64', unit: 'mH', read: (r) => r.magnetizingInductanceMh },
    { label: '약계자 시작 주파수', cell: 'C66', unit: 'Hz', read: (r) => r.fieldWeakeningStartHz },
    { label: 'V Limit', cell: 'C68', unit: 'V peak/ph', read: (r) => r.voltageLimitPeakPerPhaseV },
  ] },
  { title: '무부하 전류 · A', rows: [
    { label: '무부하 전류 · 최소', cell: 'C73', unit: 'A', read: (r) => r.noLoadCurrentMinA },
    { label: '무부하 전류 · 평균', cell: 'C74', unit: 'A', read: (r) => r.noLoadCurrentAverageA },
    { label: '무부하 전류 · 최대', cell: 'C75', unit: 'A', read: (r) => r.noLoadCurrentMaxA },
  ] },
  { title: 'Rs · Ω', rows: [
    { label: '최소', cell: 'C77', unit: 'Ω', read: (r) => r.rsMinOhm },
    { label: 'Rs · 평균', cell: 'C78', unit: 'Ω', read: (r) => r.rsAverageOhm },
    { label: '최대', cell: 'C79', unit: 'Ω', read: (r) => r.rsMaxOhm },
  ] },
  { title: 'Lsigma · mH', rows: [
    { label: '최소', cell: 'C81', unit: 'mH', read: (r) => r.leakageMinMh },
    { label: 'Lσ · 평균', cell: 'C82', unit: 'mH', read: (r) => r.leakageAverageMh },
    { label: '최대', cell: 'C83', unit: 'mH', read: (r) => r.leakageMaxMh },
  ] },
  { title: 'Lm · mH', rows: [
    { label: '최소', cell: 'C85', unit: 'mH', read: (r) => r.magnetizingMinMh },
    { label: 'Lm · 평균', cell: 'C86', unit: 'mH', read: (r) => r.magnetizingAverageMh },
    { label: '최대', cell: 'C87', unit: 'mH', read: (r) => r.magnetizingMaxMh },
  ] },
  { title: 'Ls · mH', rows: [
    { label: '최소', cell: 'C89', unit: 'mH', read: (r) => r.statorMinMh },
    { label: 'Ls · 평균', cell: 'C90', unit: 'mH', read: (r) => r.statorAverageMh },
    { label: '최대', cell: 'C91', unit: 'mH', read: (r) => r.statorMaxMh },
  ] },
  { title: 'Tr · ms', rows: [
    { label: '최소', cell: 'C93', unit: 'ms', read: (r) => r.rotorTimeMinMs },
    { label: 'Tr · 평균', cell: 'C94', unit: 'ms', read: (r) => r.rotorTimeAverageMs },
    { label: '최대', cell: 'C95', unit: 'ms', read: (r) => r.rotorTimeMaxMs },
  ] },
]

const synchronousGroups: ResultGroup<SynchronousResults>[] = [
  { title: '정격 운전점', rows: [
    { label: '모터 용량', cell: 'C7', unit: 'kW', read: (r) => r.powerKw },
    { label: '모터 용량', cell: 'C8', unit: 'HP', read: (r) => r.powerHp },
    { label: '동기 속도', cell: 'C11', unit: 'rpm', read: (r) => r.synchronousSpeedRpm },
    { label: '정격 토크', cell: 'C12', unit: 'N·m', read: (r) => r.torqueNm },
    { label: '토크 변환', cell: 'C13', unit: 'lbf·in', read: (r) => r.torqueLbfIn },
    { label: '토크 변환', cell: 'C14', unit: 'lbf·ft', read: (r) => r.torqueLbfFt },
    { label: '토크 변환', cell: 'C15', unit: 'kgf·m', read: (r) => r.torqueKgfM },
    { label: 'Kt', cell: 'C16', unit: 'N·m/Arms', read: (r) => r.ktNmPerArms },
    { label: 'Kt', cell: 'C17', unit: 'N·m/Apeak', read: (r) => r.ktNmPerApeak },
    { label: 'Ke · peak L-L', cell: 'C18', unit: 'Vpeak/kRPM', read: (r) => r.kePeakLineLineVPerKrpm },
    { label: 'Ke · peak phase', cell: 'C19', unit: 'Vpeak/kRPM', read: (r) => r.kePeakPhaseVPerKrpm },
    { label: 'Ke · RMS L-L', cell: 'C20', unit: 'Vrms/kRPM', read: (r) => r.keRmsLineLineVPerKrpm },
    { label: 'Ke · RMS phase', cell: 'C21', unit: 'Vrms/kRPM', read: (r) => r.keRmsPhaseVPerKrpm },
    { label: '역기전력 peak L-L', cell: 'C22', unit: 'Vpeak', read: (r) => r.backEmfPeakLineLineV },
    { label: '역기전력 peak/Hz', cell: 'C23', unit: 'V/Hz', read: (r) => r.backEmfPeakLineLineVPerHz },
    { label: '역기전력 RMS L-L', cell: 'C24', unit: 'Vrms', read: (r) => r.backEmfRmsLineLineV },
    { label: '역기전력 RMS/Hz', cell: 'C25', unit: 'V/Hz', read: (r) => r.backEmfRmsLineLineVPerHz },
    { label: 'PM 자속 기준', cell: 'C26', unit: 'Wb', read: (r) => r.pmFluxRefAltWb },
    { label: 'PM 자속 기준', cell: 'C27', unit: 'Wb', read: (r) => r.pmFluxRefWb },
    { label: '모터 공급 전압', cell: 'C28', unit: 'Vpeak/ph', read: (r) => r.supplyPhasePeakV },
    { label: '역기전력', cell: 'C29', unit: 'Vpeak/ph', read: (r) => r.backEmfPhasePeakV },
    { label: '정격 전류 벡터', cell: 'C30', unit: 'Apeak', read: (r) => r.ratedCurrentPeakA },
    { label: '전기 각속도', cell: 'C31', unit: 'rad/s', read: (r) => r.electricalSpeedRadS },
    { label: '기계 각속도', cell: 'C32', unit: 'rad/s', read: (r) => r.mechanicalSpeedRadS },
    { label: '인덕턴스 전압', cell: 'C33', unit: 'Vpeak/ph', read: (r) => r.inductanceVoltageV },
    { label: 'Lq 참고', cell: 'C34', unit: 'mH', read: (r) => r.lqReferenceMh },
    { label: 'Vq', cell: 'C35', unit: 'Vpeak', read: (r) => r.vqPeakV },
    { label: 'Vd', cell: 'C36', unit: 'Vpeak', read: (r) => r.voltageDPeakV },
    { label: '전압 벡터', cell: 'C37', unit: 'Vpeak', read: (r) => r.voltageVectorPeakV },
    { label: '실효 전압', cell: 'C38', unit: 'Vrms', read: (r) => r.voltageRmsV },
    { label: '전압 벡터각', cell: 'C39', unit: '°', read: (r) => r.voltageAngleDeg },
    { label: '각속도', cell: 'C40', unit: 'rad/s', read: (r) => r.electricalSpeedRadS },
  ] },
  { title: 'Rs · Ω/ph', rows: [
    { label: 'Rs · 평균', cell: 'C47', unit: 'Ω/ph', read: (r) => r.rsAverageOhmPerPhase },
    { label: '최소', cell: 'C46', unit: 'Ω/ph', read: (r) => r.rsMinOhmPerPhase },
    { label: '최대', cell: 'C48', unit: 'Ω/ph', read: (r) => r.rsMaxOhmPerPhase },
  ] },
  { title: 'Lq · mH', rows: [
    { label: 'Lq · 최소', cell: 'C50', unit: 'mH', read: (r) => r.lqMinMh },
    { label: 'Lq · 평균', cell: 'C51', unit: 'mH', read: (r) => r.lqAverageMh },
    { label: 'Lq · 최대', cell: 'C52', unit: 'mH', read: (r) => r.lqMaxMh },
    { label: 'Lq · 튜닝값', cell: 'C53', unit: 'mH', read: (r) => r.lqTunedMh },
  ] },
  { title: 'Ld · mH', rows: [
    { label: '최소', cell: 'C55', unit: 'mH', read: (r) => r.ldMinMh },
    { label: 'Ld · 평균', cell: 'C56', unit: 'mH', read: (r) => r.ldAverageMh },
    { label: '최대', cell: 'C57', unit: 'mH', read: (r) => r.ldMaxMh },
    { label: 'Ld · 튜닝값', cell: 'C58', unit: 'mH', read: (r) => r.ldTunedMh },
    { label: '돌극비', cell: 'C59', unit: '', read: (r) => r.saliencyRatio },
  ] },
  { title: 'PM 자속 기준 · Wb', rows: [
    { label: '최소', cell: 'C61', unit: 'Wb', read: (r) => r.pmFluxMinWb },
    { label: 'PM 자속 · 평균', cell: 'C62', unit: 'Wb', read: (r) => r.pmFluxAverageWb },
    { label: '최대', cell: 'C63', unit: 'Wb', read: (r) => r.pmFluxMaxWb },
  ] },
]

function App() {
  const [mode, setMode] = useState<Mode>('induction')
  const [locale, setLocale] = useState<Locale>(() => localStorage.getItem('motor-constants-locale') === 'en' ? 'en' : 'ko')
  const [induction, setInduction] = useState(initialInduction)
  const [synchronous, setSynchronous] = useState(initialSynchronous)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(() => isRunningAsInstalledApp())
  const [showInstallHelp, setShowInstallHelp] = useState(false)
  const installPlatform = getInstallPlatform()
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW()

  const inductionResult = useMemo(() => calculateInduction(induction), [induction])
  const synchronousResult = useMemo(() => calculateSynchronous(synchronous), [synchronous])
  const activeResult = mode === 'induction' ? inductionResult : synchronousResult
  const canCalculate = activeResult.ok
  const calculationIssues = activeResult.ok ? [] : activeResult.issues

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }
    const installedHandler = () => setIsInstalled(true)
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', installedHandler)
    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  useEffect(() => { localStorage.setItem('motor-constants-locale', locale) }, [locale])
  useEffect(() => { document.documentElement.lang = locale === 'en' ? 'en' : 'ko' }, [locale])

  async function installApp() {
    if (!installPrompt) {
      setShowInstallHelp(true)
      return
    }
    const promptEvent = installPrompt
    setInstallPrompt(null)
    try {
      await promptEvent.prompt()
      const choice = await promptEvent.userChoice
      if (choice.outcome === 'accepted') setIsInstalled(true)
    } catch {
      setShowInstallHelp(true)
    }
  }

  function updateInduction<K extends keyof InductionInputs>(key: K, value: InductionInputs[K]) {
    setInduction((current) => ({ ...current, [key]: value }))
  }

  function updateSynchronous<K extends keyof SynchronousInputs>(key: K, value: SynchronousInputs[K]) {
    setSynchronous((current) => ({ ...current, [key]: value }))
  }

  const i = inductionResult.ok ? inductionResult.value : null
  const s = synchronousResult.ok ? synchronousResult.value : null

  function emailReport() {
    const subject = tr(locale, mode === 'induction' ? '유도기 결과 보고서' : '동기기 결과 보고서')
    const body = mode === 'induction' && i ? makeInductionReport(i, induction, locale) : s ? makeSynchronousReport(s, synchronous, locale) : ''
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="모터 상수 계산기 홈">
          <span className="brand-mark"><svg viewBox="0 0 36 36" aria-hidden="true"><path d="M18 3.5 31 11v14L18 32.5 5 25V11L18 3.5Z"/><path d="M18 9v9l7 4M18 18l-7 6"/><circle cx="18" cy="18" r="3"/></svg></span>
          <span><strong>{tr(locale, '모터 상수 계산기')}</strong><small>{tr(locale, '전동기 해석 도구')}</small></span>
        </a>
        <div className="topbar-right">
          <label className="language-control"><span>{tr(locale, '언어')}</span><select aria-label={tr(locale, '언어')} value={locale} onChange={(event) => setLocale(event.currentTarget.value as Locale)}><option value="ko">한국어</option><option value="en">English</option></select></label>
          <span className="connection"><i />{tr(locale, '브라우저 내 계산')}</span>
          {!isInstalled && (installPrompt || installPlatform !== 'other') && <button className="install-button" onClick={installApp}>{tr(locale, installPrompt ? '앱 설치' : '설치 방법')}</button>}
        </div>
      </header>

      {showInstallHelp && <div className="install-help-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowInstallHelp(false) }}><section className="install-help-dialog" role="dialog" aria-modal="true" aria-labelledby="install-help-title" onKeyDown={(event) => { if (event.key === 'Escape') setShowInstallHelp(false) }}><div className="install-help-heading"><h2 id="install-help-title">{tr(locale, '이 앱을 설치하는 방법')}</h2><button type="button" className="chart-close" aria-label={tr(locale, '닫기')} onClick={() => setShowInstallHelp(false)}>×</button></div><ol>{(installPlatform === 'ios' ? ['Safari에서 이 페이지를 여세요.', '공유 버튼을 누른 다음 홈 화면에 추가를 선택하세요.'] : installPlatform === 'android' ? ['브라우저 메뉴(⋮)를 여세요.', '앱 설치 또는 홈 화면에 추가를 선택하세요.'] : ['브라우저 메뉴를 여세요.', '앱 설치 또는 홈 화면에 추가를 선택하세요.']).map((step) => <li key={step}>{tr(locale, step)}</li>)}</ol><p>{tr(locale, '설치 메뉴가 보이지 않으면 Safari 또는 Chrome에서 이 페이지를 여세요.')}</p></section></div>}

      {needRefresh && <div className="update-banner" role="status"><span>{tr(locale, '새 버전을 사용할 수 있습니다.')}</span><button onClick={() => updateServiceWorker(true)}>{tr(locale, '새로고침')}</button></div>}

      <main id="top">
        <section className="intro">
          <div className="intro-copy"><div className="eyebrow"><span className="signal" /> MOTOR CONSTANTS / CALCULATOR</div>
            <h1>{tr(locale, '전동기 상수를')}<br /><span>{tr(locale, '빠르게 산출합니다.')}</span></h1>
            <p>{tr(locale, '정격 사양을 입력하면 계산 결과와 주파수 응답을 바로 확인할 수 있습니다. 계산은 이 기기 안에서 처리됩니다.')}</p>
          </div>
          <div className="intro-illustration" aria-hidden="true">
            <div className="orbit orbit-one" /><div className="orbit orbit-two" />
            <div className="motor-core"><div className="motor-ring"><div className="motor-hub"><span /></div></div></div>
            <span className="orbit-label label-a">3Φ</span><span className="orbit-label label-b">ω</span><span className="orbit-label label-c">V / I</span>
          </div>
        </section>

        <nav className="mode-switch" aria-label={tr(locale, '전동기 종류 선택')}>
          <button className={mode === 'induction' ? 'selected' : ''} onClick={() => setMode('induction')} aria-pressed={mode === 'induction'}><span className="tab-symbol">IM</span><span>{tr(locale, '유도기')}</span><small>Induction motor</small></button>
          <button className={mode === 'synchronous' ? 'selected' : ''} onClick={() => setMode('synchronous')} aria-pressed={mode === 'synchronous'}><span className="tab-symbol">IPM</span><span>{tr(locale, '동기기')}</span><small>Interior PM motor</small></button>
          <div className={`mode-state ${canCalculate ? 'ready' : ''}`}><span className="state-dot" />{tr(locale, canCalculate ? '계산 완료' : '입력 확인 필요')}</div>
        </nav>

        <div className="workspace">
          <aside className="input-panel">
            <div className="panel-title"><div><span className="panel-kicker">INPUT / {mode === 'induction' ? 'IM' : 'IPM'}</span><h2>{tr(locale, '모터 사양')}</h2></div><span className="input-indicator"><i /> {tr(locale, '입력')}</span></div>
            {mode === 'induction' ? <>
              <FieldSection locale={locale} title="정격 조건" note="노란색 셀을 기준으로 분리했습니다.">
                <NumberField label={tr(locale, '모터 용량')} cell="C6" unit="W" step={100} min={0} value={induction.powerW} onChange={(v) => updateInduction('powerW', v)} />
                <NumberField label={tr(locale, '극수')} cell="C9" unit={locale === 'en' ? 'poles' : '극'} step={2} min={2} value={induction.poles} onChange={(v) => updateInduction('poles', v)} />
                <NumberField label={tr(locale, '주파수')} cell="C10" unit="Hz" step={1} min={0} value={induction.frequencyHz} onChange={(v) => updateInduction('frequencyHz', v)} />
                <NumberField label={tr(locale, '정격 속도')} cell="C12" unit="rpm" step={1} min={0} value={induction.ratedSpeedRpm} onChange={(v) => updateInduction('ratedSpeedRpm', v)} />
                <NumberField label={tr(locale, '정격 전압')} cell="C20" unit="V" step={1} min={0} value={induction.ratedVoltageV} onChange={(v) => updateInduction('ratedVoltageV', v)} />
                <NumberField label={tr(locale, '정격 전류')} cell="C21" unit="A" step={0.1} min={0} value={induction.ratedCurrentA} onChange={(v) => updateInduction('ratedCurrentA', v)} />
                <NumberField label={tr(locale, '효율')} cell="C22" unit="%" step={1} min={0} max={100} displayScale={100} value={induction.efficiency} onChange={(v) => updateInduction('efficiency', v)} />
                <NumberField label={tr(locale, '선간 저항')} cell="C69" unit="Ω" step={0.01} min={0} value={induction.lineResistanceOhm} onChange={(v) => updateInduction('lineResistanceOhm', v)} />
              </FieldSection>
              <FieldSection locale={locale} title="제어 조건">
                <NumberField label={tr(locale, 'Id 하한')} cell="C61" unit="%" step={1} min={0} max={100} displayScale={100} value={induction.idFloor} onChange={(v) => updateInduction('idFloor', v)} />
                <NumberField label={tr(locale, '약계자 시작')} cell="C65" unit="%" step={1} min={0} displayScale={100} value={induction.fieldWeakeningStart} onChange={(v) => updateInduction('fieldWeakeningStart', v)} />
                <NumberField label={tr(locale, '전압 여유')} cell="C67" unit="%" step={0.1} min={0} max={98.9} displayScale={100} value={induction.voltageHeadroom} onChange={(v) => updateInduction('voltageHeadroom', v)} />
                <NumberField label={tr(locale, '부하')} cell="C70" unit="%" step={1} min={0} displayScale={100} value={induction.loadFactor} onChange={(v) => updateInduction('loadFactor', v)} />
              </FieldSection>
              <details className="frequency-settings">
                <summary><span>{tr(locale, '주파수별 계산 조건')}</span><small>F103:F126 · 24 {tr(locale, '계산점')}</small></summary>
                <div className="frequency-grid">{induction.sweepHz.map((hz, index) => <label key={index}><span>F{index + 103}</span><input type="number" inputMode="decimal" step="0.1" value={Number.isFinite(hz) ? hz : ''} onChange={(event) => {
                  const next = event.currentTarget.value === '' ? Number.NaN : event.currentTarget.valueAsNumber
                  updateInduction('sweepHz', induction.sweepHz.map((old, i) => i === index ? next : old))
                }} aria-label={locale === 'en' ? `F${index + 103} frequency input (Hz)` : `F${index + 103} 주파수 입력`} /><em>Hz</em></label>)}</div>
              </details>
            </> : <>
              <FieldSection locale={locale} title="정격 조건" note="IPM 상수 계산기 입력 셀 기준입니다.">
                <NumberField label={tr(locale, '모터 용량')} cell="C6" unit="W" step={100} min={0} value={synchronous.powerW} onChange={(v) => updateSynchronous('powerW', v)} />
                <NumberField label={tr(locale, '극수')} cell="C9" unit={locale === 'en' ? 'poles' : '극'} step={2} min={2} value={synchronous.poles} onChange={(v) => updateSynchronous('poles', v)} />
                <NumberField label={tr(locale, '동기 주파수')} cell="C10" unit="Hz" step={1} min={0} value={synchronous.frequencyHz} onChange={(v) => updateSynchronous('frequencyHz', v)} />
                <NumberField label={tr(locale, '정격 전압')} cell="C41" unit="V" step={1} min={0} value={synchronous.ratedVoltageV} onChange={(v) => updateSynchronous('ratedVoltageV', v)} />
                <NumberField label={tr(locale, '정격 전류')} cell="C42" unit="A" step={0.1} min={0} value={synchronous.ratedCurrentA} onChange={(v) => updateSynchronous('ratedCurrentA', v)} />
                <NumberField label={tr(locale, '선간 저항')} cell="C43" unit="Ω" step={0.01} min={0} value={synchronous.lineResistanceOhm} onChange={(v) => updateSynchronous('lineResistanceOhm', v)} />
              </FieldSection>
              <FieldSection locale={locale} title="튜닝 입력" note="자동 산출 범위와 구분되는 원본 노란색 입력입니다.">
                <NumberField label={tr(locale, 'Lq 최종 튜닝값')} cell="C53" unit="mH" step={0.01} min={0} value={synchronous.lqTunedMh} onChange={(v) => updateSynchronous('lqTunedMh', v)} />
                <NumberField label={tr(locale, 'Ld 최종 튜닝값')} cell="C58" unit="mH" step={0.01} min={0} value={synchronous.ldTunedMh} onChange={(v) => updateSynchronous('ldTunedMh', v)} />
              </FieldSection>
            </>}
            {!activeResult.ok && <div className="validation-message" role="alert"><strong>{tr(locale, '계산에 필요한 값을 확인하세요')}</strong><ul>{activeResult.issues.map((issue) => <li key={issue}>{tr(locale, issue)}</li>)}</ul></div>}
          </aside>

          <section className="output-panel" aria-live="polite">
            <div className="output-heading"><div><span className="panel-kicker">OUTPUT / LIVE</span><h2>{tr(locale, '계산 결과')}</h2></div><div className="output-actions"><button type="button" className="report-button" disabled={!canCalculate} title={tr(locale, '메일 앱에서 이메일 작성 창 열기')} onClick={emailReport}>{tr(locale, '결과 레포트 이메일 작성')}</button><span className={`result-state ${canCalculate ? 'valid' : ''}`}><i />{tr(locale, canCalculate ? '유효한 입력' : '계산 대기')}</span></div></div>
            {mode === 'induction' && i ? <InductionOutput result={i} locale={locale} /> : mode === 'synchronous' && s ? <SynchronousOutput result={s} locale={locale} /> : <><div className="empty-result"><div className="empty-wave"><span /><span /><span /><span /><span /><span /><span /></div><strong>{tr(locale, '정격 사양을 입력하면 결과가 표시됩니다.')}</strong>{calculationIssues.length > 0 && <ul className="output-issues" role="alert">{calculationIssues.map((issue) => <li key={issue}>{tr(locale, issue)}</li>)}</ul>}<p>{tr(locale, calculationIssues.length > 0 ? '표시된 입력 또는 계산 조건을 확인하면 유효한 결과가 자동으로 표시됩니다.' : '기본 입력값 0은 원본 통합문서의 저장값입니다. 오류 결과를 정상값으로 대신하지 않습니다.')}</p><span className="empty-ref">FORMULA ENGINE · LOCAL ONLY</span></div>{mode === 'synchronous' && <IpmOperatingCharts curves={null} locale={locale} />}</>}
          </section>
        </div>

        <footer className="page-footer"><span>{tr(locale, '결과는 Excel 원본 수식 구조를 따라 계산합니다.')}</span><span>{tr(locale, '수식 결과는 Excel에서 재계산된 기준 사례와 비교하기 전까지 미검증 상태입니다.')}</span></footer>
      </main>
    </div>
  )
}

function InductionOutput({ result, locale }: { result: InductionResults; locale: Locale }) {
  const latest = result.points[result.points.length - 1]
  return <>
    <div className="hero-result"><div><span>{tr(locale, '정격 토크')} <small>C16</small></span><strong>{format(result.torqueNm, 2)} <em>N·m</em></strong></div><div className="hero-result-side"><span>{tr(locale, '슬립 주파수')}</span><b>{format(result.slipHz, 2)} <em>Hz</em></b></div><div className="hero-result-side"><span>{tr(locale, '정격 역률')}</span><b>{format(result.powerFactor, 3)}</b></div></div>
    <ConstantCards locale={locale}>
      <ConstantCard label="Rs" minimum={result.rsMinOhm} average={result.rsAverageOhm} maximum={result.rsMaxOhm} unit="Ω" minCell="C77" averageCell="C78" maxCell="C79" description="고정자 저항 추정 범위" formula="C77=C69×0.4 · C78=AVERAGE(C77,C79) · C79=C69×0.6" process="원본 선간 저항 C69에 최소·평균·최대 계수를 적용합니다." locale={locale} />
      <ConstantCard label="무부하 전류" minimum={result.noLoadCurrentMinA} average={result.noLoadCurrentAverageA} maximum={result.noLoadCurrentMaxA} unit="A" minCell="C73" averageCell="C74" maxCell="C75" description="무부하 전류 추정 범위" formula="C73=MAX(C26,C29) · C74=AVERAGE(C73,C75) · C75=MAX(C28,C29)" process="무부하 전류의 비율 추정값과 인덕턴스 기반 계산값을 비교해 최소·최대를 구합니다." locale={locale} />
      <ConstantCard label="Lσ" minimum={result.leakageMinMh} average={result.leakageAverageMh} maximum={result.leakageMaxMh} unit="mH" minCell="C81" averageCell="C82" maxCell="C83" description="누설 인덕턴스 추정 범위" formula="C81=C36/C39×1000 · C82=AVERAGE(C81,C83) · C83=C36/C38×1000" process="Vds와 di/dt 최대·최소 조건으로 범위를 계산합니다." locale={locale} />
      <ConstantCard label="Ls" minimum={result.statorMinMh} average={result.statorAverageMh} maximum={result.statorMaxMh} unit="mH" minCell="C89" averageCell="C90" maxCell="C91" description="고정자 인덕턴스 추정 범위" formula="C89=(81×C20)/(C10×C28) · C90=AVERAGE(C89,C91) · C91=(81×C20)/(C10×C26)" process="정격 전압, 주파수, 무부하 전류 최소·최대 셀을 참조합니다." locale={locale} />
      <ConstantCard label="Tr" minimum={result.rotorTimeMinMs} average={result.rotorTimeAverageMs} maximum={result.rotorTimeMaxMs} unit="ms" minCell="C93" averageCell="C94" maxCell="C95" description="회전자 시정수 추정 범위" formula="C93=ABS(C57/C56/(2×PI()×C14)×1000) · C94=AVERAGE(C93,C95) · C95=ABS(C48/C47/(2×PI()×C14)×1000)" process="각 회전 좌표계에서 산출한 전류비와 슬립 주파수로 계산합니다." locale={locale} />
      <ConstantCard label="Lm" minimum={result.magnetizingMinMh} average={result.magnetizingAverageMh} maximum={result.magnetizingMaxMh} unit="mH" minCell="C85" averageCell="C86" maxCell="C87" description="자화 인덕턴스 추정 범위" formula="C85=C89−0.5×C81 · C86=AVERAGE(C85,C87) · C87=C91−0.5×C83" process="Ls 범위에서 Lσ의 절반을 차감합니다." locale={locale} />
    </ConstantCards>
    <div className="charts-grid">
      <InductionChart locale={locale} title={tr(locale, '주파수별 전압 응답')} subtitle={tr(locale, '전압 제어기 적용 · 원본 계열 R / S / U')} data={result.points} lines={[['vdAfterV', 'Vd', '#d69c27'], ['vqAfterV', 'Vq', '#126d69'], ['lineRmsAfterV', 'Vrms (L-L)', '#637a7c']]} unit="V" />
      <InductionChart locale={locale} title={tr(locale, '주파수별 전류 응답')} subtitle={tr(locale, '전압 제어기 적용 · 원본 계열 O / P / Q')} data={result.points} lines={[['idAfterA', 'Id', '#d69c27'], ['iqAfterA', 'Iq', '#126d69'], ['rmsCurrentAfterA', 'Irms', '#637a7c']]} unit="A" />
    </div>
    <details className="detail-results"><summary>{tr(locale, '전체 결과와 수식 셀 보기')}</summary><ResultTable groups={inductionGroups} result={result} locale={locale} />
      <section className="result-group extra-results"><h3>{tr(locale, '추가 파생값')}</h3><div className="result-row"><span>{tr(locale, '토크 변환 · lbf·in')}<small>C17</small></span><b>{format(result.torqueLbfIn)}<em>lbf·in</em></b></div><div className="result-row"><span>{tr(locale, '토크 변환 · lbf·ft')}<small>C18</small></span><b>{format(result.torqueLbfFt)}<em>lbf·ft</em></b></div><div className="result-row"><span>{tr(locale, '토크 변환 · kgf·m')}<small>C19</small></span><b>{format(result.torqueKgfM)}<em>kgf·m</em></b></div><div className="result-row"><span>{tr(locale, '무부하 전류 범위')}<small>C26 / C28</small></span><b>{format(result.noLoadCurrentLowA)} – {format(result.noLoadCurrentHighA)}<em>A</em></b></div><div className="result-row"><span>{tr(locale, '전압 한계')}<small>C68</small></span><b>{format(result.voltageLimitPeakPerPhaseV)}<em>V peak/ph</em></b></div><div className="result-row"><span>{tr(locale, '약계자 시작 주파수')}<small>C66</small></span><b>{format(result.fieldWeakeningStartHz)}<em>Hz</em></b></div><div className="result-row"><span>Tr {tr(locale, '최소 / 최대')}<small>C93 / C95</small></span><b>{format(result.rotorTimeMinMs)} / {format(result.rotorTimeMaxMs)}<em>ms</em></b></div></section>
    </details>
    {latest && <p className="chart-footnote">{result.points.length} {tr(locale, '계산점')} · {tr(locale, '마지막 주파수')} {format(latest.frequencyHz)} Hz · {tr(locale, '그래프와 표시값은 같은 계산 결과에서 생성')}</p>}
  </>
}

function InductionChart({ title, subtitle, data, lines, unit, locale }: { title: string; subtitle: string; data: InductionResults['points']; lines: Array<[keyof InductionResults['points'][number], string, string]>; unit: string; locale: Locale }) {
  const [expanded, setExpanded] = useState(false)
  const chart = (showLabels: boolean) => <ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: showLabels ? 24 : 8, right: showLabels ? 20 : 12, bottom: 2, left: -14 }}>
      <CartesianGrid stroke="#dce5e2" strokeDasharray="3 5" vertical={false} />
      <XAxis dataKey="frequencyHz" tick={{ fill: '#708386', fontSize: showLabels ? 12 : 10 }} tickLine={false} axisLine={{ stroke: '#b9c8c5' }} tickFormatter={(value: number) => `${format(value, 0)}`} minTickGap={showLabels ? 15 : 28} />
      <YAxis tick={{ fill: '#708386', fontSize: showLabels ? 12 : 10 }} tickLine={false} axisLine={false} width={48} label={{ value: unit, angle: -90, position: 'insideLeft', fill: '#708386', fontSize: 11 }} />
      <Tooltip formatter={(value) => [`${format(Number(value), 2)} ${unit}`, '']} labelFormatter={(label) => `${format(Number(label), 2)} Hz`} contentStyle={{ borderRadius: 4, borderColor: '#cad7d4', fontSize: 12 }} />
      <Legend verticalAlign="top" align="right" height={32} iconType="plainline" wrapperStyle={{ fontSize: 12, color: '#52696c' }} />
      {lines.map(([key, label, color], index) => <Line key={label} type="monotone" dataKey={key} name={label} stroke={color} strokeWidth={2} dot={showLabels ? { r: 2, fill: color } : false} activeDot={{ r: 4 }} isAnimationActive={false}>
        {showLabels && <LabelList dataKey={key} position={index === 1 ? 'bottom' : 'top'} formatter={(value) => typeof value === 'number' ? format(value, 1) : ''} style={{ fill: color, fontSize: 9, fontWeight: 600 }} />}
      </Line>)}
    </LineChart></ResponsiveContainer>
  return <><section className="chart-panel"><div className="chart-heading"><div><h3>{title}</h3><p>{subtitle}</p></div><div className="chart-tools"><span>Hz <b>→</b> {unit}</span><button type="button" className="chart-expand" aria-label={`${title} ${tr(locale, '크게 보기')}`} title={tr(locale, '크게 보기')} onClick={() => setExpanded(true)}>+</button></div></div>
    <div className="chart-wrap">{chart(false)}</div>
  </section>
    {expanded && <div className="chart-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setExpanded(false) }}><section className="chart-modal" role="dialog" aria-modal="true" aria-label={`${title} 확대 그래프`} onKeyDown={(event) => { if (event.key === 'Escape') setExpanded(false) }}><div className="chart-modal-heading"><div><h2>{title}</h2><p>{subtitle} · {tr(locale, '각 점에 계산값 표시')}</p></div><button type="button" className="chart-close" aria-label={tr(locale, '그래프 닫기')} onClick={() => setExpanded(false)}>×</button></div><div className="chart-modal-wrap">{chart(true)}</div><div className="chart-label-note">X: {tr(locale, '주파수 (Hz)')} · Y: {unit} · {tr(locale, '숫자는 해당 주파수 계산값')}</div></section></div>}
  </>
}

type AxisDomain = { x: [number, number]; y: [number, number] }
type OperatingSeries = { key: string; label: string; color: string; points: OperatingPoint[]; marker?: boolean }

function validSegments(points: OperatingPoint[]) {
  const segments: Array<Array<{ x: number; y: number }>> = []
  let segment: Array<{ x: number; y: number }> = []
  for (const point of points) {
    if (point.y === null || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      if (segment.length) segments.push(segment)
      segment = []
    } else segment.push({ x: point.x, y: point.y })
  }
  if (segment.length) segments.push(segment)
  return segments
}

function OperatingChart({ title, xLabel, yLabel, series, initialDomain, locale, chartId }: { title: string; xLabel: string; yLabel: string; series: OperatingSeries[]; initialDomain: AxisDomain; locale: Locale; chartId: string }) {
  const [domain, setDomain] = useState(initialDomain)
  const [hidden, setHidden] = useState<string[]>([])
  const [expanded, setExpanded] = useState(false)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{ domain: AxisDomain; x: number; y: number; distance: number | null } | null>(null)
  useEffect(() => {
    if (!expanded) return
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setExpanded(false) }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [expanded])
  const isHidden = (key: string) => hidden.includes(key)
  const toggleSeries = (key: string) => setHidden((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])
  const reset = () => { setDomain(initialDomain); setHidden([]) }

  function plotMetrics(element: HTMLElement) {
    const rect = element.getBoundingClientRect()
    return { rect, width: Math.max(1, rect.width - 76), height: Math.max(1, rect.height - 58) }
  }
  function zoom(factor: number, anchorX: number, anchorY: number) {
    setDomain((current) => ({
      x: [anchorX + (current.x[0] - anchorX) * factor, anchorX + (current.x[1] - anchorX) * factor],
      y: [anchorY + (current.y[0] - anchorY) * factor, anchorY + (current.y[1] - anchorY) * factor],
    }))
  }
  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault()
    const { rect, width, height } = plotMetrics(event.currentTarget)
    const px = Math.max(0, Math.min(width, event.clientX - rect.left - 62)) / width
    const py = Math.max(0, Math.min(height, event.clientY - rect.top - 18)) / height
    const anchorX = domain.x[0] + px * (domain.x[1] - domain.x[0])
    const anchorY = domain.y[1] - py * (domain.y[1] - domain.y[0])
    zoom(event.deltaY > 0 ? 1.15 : 0.87, anchorX, anchorY)
  }
  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.current.size === 1) gesture.current = { domain, x: event.clientX, y: event.clientY, distance: null }
    else if (pointers.current.size === 2) {
      const pts = [...pointers.current.values()]
      gesture.current = { domain, x: pts[0].x, y: pts[0].y, distance: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) }
    }
  }
  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const currentGesture = gesture.current
    if (!currentGesture) return
    if (pointers.current.size >= 2 && currentGesture.distance) {
      const pts = [...pointers.current.values()]
      const distance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      if (distance > 0) {
        const factor = currentGesture.distance / distance
        setDomain({
          x: [(currentGesture.domain.x[0] + currentGesture.domain.x[1]) / 2 + (currentGesture.domain.x[0] - currentGesture.domain.x[1]) / 2 * factor, (currentGesture.domain.x[0] + currentGesture.domain.x[1]) / 2 + (currentGesture.domain.x[1] - currentGesture.domain.x[0]) / 2 * factor],
          y: [(currentGesture.domain.y[0] + currentGesture.domain.y[1]) / 2 + (currentGesture.domain.y[0] - currentGesture.domain.y[1]) / 2 * factor, (currentGesture.domain.y[0] + currentGesture.domain.y[1]) / 2 + (currentGesture.domain.y[1] - currentGesture.domain.y[0]) / 2 * factor],
        })
      }
    } else {
      const { width, height } = plotMetrics(event.currentTarget)
      const dx = event.clientX - currentGesture.x
      const dy = event.clientY - currentGesture.y
      const xShift = -(dx / width) * (currentGesture.domain.x[1] - currentGesture.domain.x[0])
      const yShift = (dy / height) * (currentGesture.domain.y[1] - currentGesture.domain.y[0])
      setDomain({ x: [currentGesture.domain.x[0] + xShift, currentGesture.domain.x[1] + xShift], y: [currentGesture.domain.y[0] + yShift, currentGesture.domain.y[1] + yShift] })
    }
  }
  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId)
    if (pointers.current.size === 1) {
      const [remaining] = [...pointers.current.values()]
      gesture.current = { domain, x: remaining.x, y: remaining.y, distance: null }
    } else gesture.current = null
  }

  const chartPlot = () => <div className="operating-chart-wrap" onWheel={handleWheel} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp}>
    <ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{ top: 14, right: 14, bottom: 24, left: 12 }}>
      <CartesianGrid stroke="#dce5e2" strokeDasharray="3 5" />
      <XAxis type="number" dataKey="x" name={xLabel} domain={domain.x} allowDataOverflow tick={{ fill: '#708386', fontSize: expanded ? 12 : 10 }} tickLine={false} axisLine={{ stroke: '#b9c8c5' }} tickFormatter={(value: number) => format(value, 0)} label={{ value: xLabel, position: 'insideBottom', offset: -17, fill: '#637b79', fontSize: expanded ? 12 : 10 }} />
      <YAxis type="number" dataKey="y" name={yLabel} domain={domain.y} allowDataOverflow width={48} tick={{ fill: '#708386', fontSize: expanded ? 12 : 10 }} tickLine={false} axisLine={false} tickFormatter={(value: number) => format(value, 0)} label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: '#637b79', fontSize: expanded ? 12 : 10 }} />
      <Tooltip formatter={(value, name) => [`${format(Number(value), 4)} ${yLabel.match(/\(([^)]+)\)/)?.[1] ?? ''}`, String(name)]} labelFormatter={(label) => `${xLabel.match(/\(([^)]+)\)/)?.[1] ?? ''} = ${format(Number(label), 4)}`} contentStyle={{ borderRadius: 4, borderColor: '#cad7d4', fontSize: 11 }} />
      {series.flatMap((item) => !isHidden(item.key) ? validSegments(item.points).map((segment, index) => <Scatter key={`${item.key}-${index}`} name={item.label} data={segment.map((point) => ({ ...point, r: item.marker ? 8 : 1 }))} dataKey="y" xAxisId={0} yAxisId={0} fill={item.color} line={!item.marker ? { stroke: item.color, strokeWidth: 2 } : false} shape={item.marker ? 'star' : 'circle'} isAnimationActive={false} />) : [])}
    </ScatterChart></ResponsiveContainer>
  </div>
  const legend = () => <div className="operating-legend" aria-label={tr(locale, '곡선 표시 선택')}>
    {series.map((item) => <button type="button" key={item.key} aria-pressed={!isHidden(item.key)} className={isHidden(item.key) ? 'is-hidden' : ''} onClick={() => toggleSeries(item.key)}><i style={{ '--series-color': item.color } as React.CSSProperties} className={item.marker ? 'legend-marker' : ''} />{item.label}</button>)}
  </div>

  return <><section className="operating-chart" data-chart={chartId}>
    <div className="operating-chart-heading"><div><h4>{title}</h4><p>X: {xLabel} · Y: {yLabel}</p></div><div className="operating-chart-actions"><button type="button" className="chart-reset" onClick={reset}>{tr(locale, '범위 초기화')}</button><button type="button" className="chart-expand" aria-label={`${title} ${tr(locale, '크게 보기')}`} title={tr(locale, '크게 보기')} onClick={() => setExpanded(true)}>+</button></div></div>
    {legend()}{chartPlot()}
    <p className="operating-gesture-hint">{tr(locale, '휠/핀치로 확대·축소 · 드래그로 이동')}</p>
  </section>
    {expanded && <div className="operating-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setExpanded(false) }}><section className="operating-modal" role="dialog" aria-modal="true" aria-label={`${title} ${tr(locale, '확대 그래프')}`}><div className="operating-modal-heading"><div><h3>{title}</h3><p>X: {xLabel} · Y: {yLabel}</p></div><div className="operating-chart-actions"><button type="button" className="chart-reset" onClick={reset}>{tr(locale, '범위 초기화')}</button><button type="button" className="chart-close" aria-label={tr(locale, '그래프 닫기')} onClick={() => setExpanded(false)}>×</button></div></div>{legend()}{chartPlot()}<p className="operating-gesture-hint">{tr(locale, '휠/핀치로 확대·축소 · 드래그로 이동')}</p></section></div>}
  </>
}

function IpmOperatingCharts({ curves, locale }: { curves: IpmOperatingCurves | null; locale: Locale }) {
  const range: OperatingPoint[] = []
  const intersection: OperatingPoint[] = curves?.intersection ? [{ x: curves.intersection.idA, y: curves.intersection.iqA }] : []
  const outputPoints = curves?.outputCurrent ?? range
  const maxOutput = Math.max(1, ...outputPoints.flatMap((point) => point.y === null ? [] : [point.y]))
  const firstSeries: OperatingSeries[] = [
    { key: 'constantTorque', label: tr(locale, '일정 토크 곡선'), color: '#3266b1', points: curves?.constantTorque ?? range },
    { key: 'maximumTorque', label: tr(locale, '최대 토크 곡선 (MTPA)'), color: '#df8a31', points: curves?.maximumTorque ?? range },
    { key: 'currentLimit', label: tr(locale, '전류 제한원'), color: '#398568', points: curves?.currentLimit ?? range },
    { key: 'intersection', label: tr(locale, 'MTPA 동작점'), color: '#203c61', points: intersection, marker: true },
  ]
  const secondSeries: OperatingSeries[] = [{ key: 'outputCurrent', label: tr(locale, '출력 전류'), color: '#c6534c', points: outputPoints }]
  return <section className="ipm-operating-section" aria-label={tr(locale, '운전 특성 그래프')}>
    <div className="ipm-operating-title"><span className="panel-kicker">IPM / PERFORMANCE</span><h3>{tr(locale, '운전 특성 그래프')}</h3><p>{tr(locale, '상수 입력을 바꾸면 곡선과 MTPA 교차점이 실시간으로 다시 계산됩니다.')}</p></div>
    {curves?.intersection && <div className="ipm-cross-summary"><b>{tr(locale, 'MTPA 교차점')}</b><span>Id = {format(curves.intersection.idA, 4)} A</span><span>Iq = {format(curves.intersection.iqA, 4)} A</span><span>Ia = {format(curves.intersection.currentLimitA, 4)} A</span></div>}
    <div className="ipm-operating-grid">
      <OperatingChart chartId="operating-point" locale={locale} title={tr(locale, 'IPM 운전 특성 곡선')} xLabel={tr(locale, 'd축 전류 Id (A)')} yLabel={tr(locale, 'q축 전류 Iq (A)')} series={firstSeries} initialDomain={{ x: [-35, 35], y: [0, 40] }} />
      <OperatingChart chartId="output-current" locale={locale} title={tr(locale, '출력 전류 vs d축 전류')} xLabel={tr(locale, 'd축 전류 Id (A)')} yLabel={tr(locale, '출력 전류 크기 Iout (A)')} series={secondSeries} initialDomain={{ x: [-23, 100], y: [0, Math.max(10, Math.ceil(maxOutput / 10) * 10)] }} />
    </div>
    {!curves && <p className="ipm-chart-empty">{tr(locale, '유효한 IPM 계산 입력을 완료하면 운전 곡선이 표시됩니다.')}</p>}
  </section>
}

function SynchronousOutput({ result, locale }: { result: SynchronousResults; locale: Locale }) {
  const candidateRows = result.lqCandidates.filter((candidate) => candidate.allowed).slice(0, 12)
  return <>
    <div className="hero-result sync-hero"><div><span>{tr(locale, 'Lq 자동 최대값')} <small>C52 · DMIN</small></span><strong>{format(result.lqMaxMh, 4)} <em>mH</em></strong></div><div className="hero-result-side"><span>{tr(locale, '정격 토크')}</span><b>{format(result.torqueNm, 2)} <em>N·m</em></b></div><div className="hero-result-side"><span>{tr(locale, '돌극비')}</span><b>{format(result.saliencyRatio, 3)}</b></div></div>
    <ConstantCards locale={locale}>
      <ConstantCard label="Rs" minimum={result.rsMinOhmPerPhase} average={result.rsAverageOhmPerPhase} maximum={result.rsMaxOhmPerPhase} unit="Ω/ph" minCell="C46" averageCell="C47" maxCell="C48" description="상별 고정자 저항 추정 범위" formula="C46=C43×0.5 · C47=AVERAGE(C46,C48) · C48=C43×0.7" process="선간 저항 입력 C43에서 최소·평균·최대 상 저항을 계산합니다." locale={locale} />
      <ConstantCard label="Lq" minimum={result.lqMinMh} average={result.lqAverageMh} maximum={result.lqMaxMh} unit="mH" minCell="C50" averageCell="C51" maxCell="C52" description="q축 인덕턴스 추정 범위" formula="C50=C52/2 · C51=AVERAGE(C50,C52) · C52=DMIN(B777:E828,2,C829:C830)" process="C52는 조건을 통과한 51개 각도 후보에서 DMIN으로 구한 값입니다." locale={locale} />
      <ConstantCard label="Ld" minimum={result.ldMinMh} average={result.ldAverageMh} maximum={result.ldMaxMh} unit="mH" minCell="C55" averageCell="C56" maxCell="C57" description="d축 인덕턴스 추정 범위" formula="C55=C53×0.4 · C56=AVERAGE(C55,C57) · C57=C53×0.8" process="원본 셀 참조를 유지해 C53 Lq 튜닝값을 사용합니다." locale={locale} />
      <ConstantCard label="PM Rotor Flux Ref" minimum={result.pmFluxMinWb} average={result.pmFluxAverageWb} maximum={result.pmFluxMaxWb} unit="Wb" minCell="C61" averageCell="C62" maxCell="C63" description="PM 회전자 자속 기준 범위" formula="C61=C62×0.8 · C62=IF(C18<>0,C27,C26) · C63=C62×1.2" process="평균 기준 자속의 80%~120%를 최소·최대값으로 표시합니다." locale={locale} />
    </ConstantCards>
    <div className="metric-strip sync-metrics">
      <Metric label={tr(locale, '동기 속도')} value={format(result.synchronousSpeedRpm)} unit="rpm" source="C11" />
      <Metric label={tr(locale, 'Ke · peak L-L')} value={format(result.kePeakLineLineVPerKrpm, 2)} unit="V/kRPM" source="C18" />
      <Metric label={tr(locale, '전압 벡터')} value={format(result.voltageVectorPeakV)} unit="Vpeak" source="C37" />
    </div>
    <div className="sync-note"><span className="note-icon">i</span><p>{tr(locale, '수정된 원본에는 그래프 정의가 없습니다. Lq 후보 51개 중 원본 조건(T/F=1)을 통과한 항목을 계산 결과와 함께 표시합니다.')}</p></div>
    <details className="detail-results"><summary>{tr(locale, '전체 결과와 수식 셀 보기')}</summary><ResultTable groups={synchronousGroups} result={result} locale={locale} />
      <section className="candidate-table"><div className="candidate-heading"><div><h3>{tr(locale, '유효 Lq 후보')}</h3><p>{tr(locale, '각도 0°~50° · 1° 간격 · DMIN 조건 적용')}</p></div><span>{candidateRows.length} {tr(locale, '개 표시')}</span></div>
        <div className="table-scroll"><table><thead><tr><th>θ</th><th>{tr(locale, 'Vd 성분')}</th><th>{tr(locale, '전압 크기')}</th><th>Lq</th><th>{tr(locale, '조건')}</th></tr></thead><tbody>{candidateRows.map((row) => <tr key={row.angleDeg}><td>{row.angleDeg}°</td><td>{format(row.vqComponentV)} V</td><td>{format(row.voltagePeakV)} V</td><td>{format(row.lqMh, 4)} mH</td><td><span className="pass-badge">{tr(locale, '통과')}</span></td></tr>)}</tbody></table></div>
      </section>
    </details>
    <IpmOperatingCharts curves={result.operatingCurves} locale={locale} />
  </>
}

declare global {
  interface BeforeInstallPromptEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }> }
  interface WindowEventMap { beforeinstallprompt: BeforeInstallPromptEvent }
  interface Navigator { standalone?: boolean }
}

function isRunningAsInstalledApp() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
}

function getInstallPlatform(): 'ios' | 'android' | 'other' {
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios'
  if (/Android/i.test(navigator.userAgent)) return 'android'
  return 'other'
}

export default App
