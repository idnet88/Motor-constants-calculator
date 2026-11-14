import { expect, test } from '@playwright/test'

async function fillInduction(page: import('@playwright/test').Page) {
  await page.getByLabel('모터 용량 (W)').fill('7500')
  await page.getByLabel('극수 (극)').fill('4')
  await page.getByLabel('주파수 (Hz)').fill('60')
  await page.getByLabel('정격 속도 (rpm)').fill('1750')
  await page.getByLabel('정격 전압 (V)').fill('460')
  await page.getByLabel('정격 전류 (A)').fill('14')
  await page.getByLabel('효율 (%)').fill('92')
  await page.getByLabel('선간 저항 (Ω)').fill('0.5')
}

async function expectConstants(page: import('@playwright/test').Page, labels: string[]) {
  for (const label of labels) {
    const card = page.locator(`[data-constant="${label}"]`)
    await expect(card).toHaveCount(1)
    const value = await card.locator('[data-stat="average"]', {}).innerText()
    expect(value.trim()).not.toBe('')
    expect(value).not.toMatch(/NaN|undefined|계산 오류/)
    await expect(card.locator('[data-stat="minimum"]', {})).not.toContainText(/NaN|undefined|계산 오류/)
    await expect(card.locator('[data-stat="maximum"]', {})).not.toContainText(/NaN|undefined|계산 오류/)
  }
}

const inductionConstants = ['Rs', '무부하 전류', 'Lσ', 'Ls', 'Tr', 'Lm']
const synchronousConstants = ['Rs', 'Lq', 'Ld', 'PM Rotor Flux Ref']

test('shows validation, recalculates induction values, and fits a phone viewport', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('계산에 필요한 값을 확인하세요')).toBeVisible()
  await fillInduction(page)
  await expect(page.getByText('계산 완료')).toBeVisible()
  await expectConstants(page, inductionConstants)
  await expect(page.locator('.metric-strip')).toHaveCount(0)
  const oldInductionRs = await page.locator('[data-constant="Rs"] [data-stat="average"]').innerText()
  await page.getByLabel('선간 저항 (Ω)').fill('0.8')
  await expect(page.locator('[data-constant="Rs"] [data-stat="average"]')).not.toHaveText(oldInductionRs)
  await expect(page.getByText('주파수별 전압 응답')).toBeVisible()
  await expect(page.getByText('주파수별 전류 응답')).toBeVisible()
  await expect(page.locator('.chart-panel')).toHaveCount(2)
  await expect(page.locator('.chart-panel .recharts-wrapper')).toHaveCount(2)
  await page.getByRole('button', { name: '주파수별 전압 응답 크게 보기' }).click()
  await expect(page.getByRole('dialog', { name: '주파수별 전압 응답 확대 그래프' })).toBeVisible()
  await expect(page.locator('.chart-modal .recharts-label-list text')).toHaveCount(72)
  await page.getByRole('button', { name: '그래프 닫기' }).click()
  await expect(page.locator('.chart-modal')).toHaveCount(0)
  await page.getByRole('button', { name: '주파수별 전류 응답 크게 보기' }).click()
  await expect(page.getByRole('dialog', { name: '주파수별 전류 응답 확대 그래프' })).toBeVisible()
  await expect(page.locator('.chart-modal .recharts-label-list text')).toHaveCount(72)
  await page.getByRole('button', { name: '그래프 닫기' }).click()
  await expect(page.getByLabel('Id 하한 (%)')).toHaveValue('50')
  await expect(page.getByLabel('약계자 시작 (%)')).toHaveValue('100')
  await expect(page.getByLabel('전압 여유 (%)')).toHaveValue('5')
  await expect(page.getByLabel('부하 (%)')).toHaveValue('100')
  const unitLabels = await page.locator('.field-control .unit').allTextContents()
  expect(unitLabels.every((unit) => unit.trim().length > 0)).toBe(true)
  await page.locator('.frequency-settings summary').click()
  expect(await page.locator('.frequency-grid em').allTextContents()).toEqual(Array(24).fill('Hz'))

  await page.getByLabel('극수 (극)').fill('3')
  await expect(page.locator('.output-issues')).toContainText('극수는 짝수여야 합니다.')
  await page.getByLabel('극수 (극)').fill('4')
  await expect(page.locator('[data-constant="Rs"]')).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByLabel('모터 용량 (W)')).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  expect(overflow).toBe(false)
})

test('shows the blocking input reason in the output area and calculates immediately when corrected', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('모터 용량 (W)').fill('5500')
  await page.getByLabel('극수 (극)').fill('4')
  await page.getByLabel('주파수 (Hz)').fill('50')
  await page.getByLabel('정격 속도 (rpm)').fill('1450')
  await page.getByLabel('정격 전압 (V)').fill('400')
  await page.getByLabel('정격 전류 (A)').fill('10.9')
  await page.getByLabel('선간 저항 (Ω)').fill('1.5')
  await expect(page.locator('.output-issues')).toContainText('효율은 0% 초과, 100% 이하여야 합니다.')
  await expect(page.locator('.constant-card')).toHaveCount(0)

  await page.getByLabel('효율 (%)').fill('')
  await expect(page.locator('.output-issues')).toContainText('효율 입력값이 유효한 숫자가 아닙니다.')
  await page.getByLabel('효율 (%)').fill('0')
  await expect(page.locator('.output-issues')).toContainText('효율은 0% 초과, 100% 이하여야 합니다.')
  await page.getByLabel('효율 (%)').fill('87.7')
  await expect(page.locator('.output-issues')).toHaveCount(0)
  await expect(page.locator('.constant-card')).toHaveCount(6)
  await expect(page.locator('[data-constant="Rs"] [data-stat="average"]')).toContainText('0.75')
})

test('calculates synchronous results and continues calculating offline', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload()
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller))

  await page.getByRole('button', { name: /동기기/ }).click()
  await expect(page.locator('.operating-chart')).toHaveCount(2)
  await expect(page.locator('.ipm-chart-empty')).toBeVisible()
  await page.getByLabel('모터 용량 (W)').fill('5000')
  await page.getByLabel('극수 (극)').fill('4')
  await page.getByLabel('동기 주파수 (Hz)').fill('60')
  await page.getByLabel('정격 전압 (V)').fill('220')
  await page.getByLabel('정격 전류 (A)').fill('20')
  await page.getByLabel('선간 저항 (Ω)').fill('0.2')
  await expect(page.getByText('계산 완료')).toBeVisible()
  await expectConstants(page, synchronousConstants)
  await expect(page.locator('.sync-metrics .metric')).toHaveCount(3)
  await expect(page.locator('.sync-metrics')).not.toContainText('PM 자속 평균')
  await expect(page.locator('.operating-chart')).toHaveCount(2)
  await page.getByRole('button', { name: 'IPM 운전 특성 곡선 크게 보기' }).click()
  const operatingDialog = page.getByRole('dialog', { name: 'IPM 운전 특성 곡선 확대 그래프' })
  await expect(operatingDialog).toBeVisible()
  const torqueLegend = operatingDialog.getByRole('button', { name: '일정 토크 곡선' })
  await torqueLegend.click()
  await expect(torqueLegend).toHaveAttribute('aria-pressed', 'false')
  await torqueLegend.click()
  await operatingDialog.getByRole('button', { name: '범위 초기화' }).click()
  await operatingDialog.getByRole('button', { name: '그래프 닫기' }).click()
  await page.getByRole('button', { name: '출력 전류 vs d축 전류 크게 보기' }).click()
  await expect(page.getByRole('dialog', { name: '출력 전류 vs d축 전류 확대 그래프' })).toBeVisible()
  await page.getByRole('button', { name: '그래프 닫기' }).click()
  const oldSyncRs = await page.locator('[data-constant="Rs"] [data-stat="average"]').innerText()
  await page.getByLabel('선간 저항 (Ω)').fill('0.4')
  await expect(page.locator('[data-constant="Rs"] [data-stat="average"]')).not.toHaveText(oldSyncRs)
  await expect(page.getByText('유효 Lq 후보')).toBeVisible()

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByText('모터 상수 계산기')).toBeVisible()
  await page.getByRole('button', { name: /유도기/ }).click()
  await fillInduction(page)
  await expect(page.getByText('계산 완료')).toBeVisible()
})

test('matches the induction example sheet constants in the result cards', async ({ page }) => {
  await page.goto('/')
  for (const [label, value] of [
    ['모터 용량 (W)', '5500'], ['극수 (극)', '4'], ['주파수 (Hz)', '50'],
    ['정격 속도 (rpm)', '1450'], ['정격 전압 (V)', '400'], ['정격 전류 (A)', '10.9'],
    ['효율 (%)', '87.7'], ['선간 저항 (Ω)', '1.5'],
  ]) await page.getByLabel(label, { exact: true }).fill(value)

  const expected = [
    ['0.6', '0.75', '0.9'], ['3.8277', '4.3663', '4.905'],
    ['6.1162', '9.1743', '12.2324'], ['132.1101', '165.1376', '198.1651'],
    ['214.4807', '331.8699', '449.2591'], ['129.052', '160.5505', '192.0489'],
  ]
  for (let index = 0; index < inductionConstants.length; index += 1) {
    const card = page.locator(`[data-constant="${inductionConstants[index]}"]`)
    for (const [statIndex, stat] of ['minimum', 'average', 'maximum'].entries()) {
      await expect(card.locator(`[data-stat="${stat}"]`)).toContainText(expected[index][statIndex])
    }
    await expect(card).not.toContainText(/NaN|undefined/)
  }
})

test('matches the synchronous example sheet constants in the result cards', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /동기기/ }).click()
  for (const [label, value] of [
    ['모터 용량 (W)', '7460'], ['극수 (극)', '10'], ['동기 주파수 (Hz)', '180'],
    ['정격 전압 (V)', '460'], ['정격 전류 (A)', '11.7'], ['선간 저항 (Ω)', '0.55'],
    ['Lq 최종 튜닝값 (mH)', '11'], ['Ld 최종 튜닝값 (mH)', '9'],
  ]) await page.getByLabel(label, { exact: true }).fill(value)

  const expected = [
    ['0.275', '0.33', '0.385'], ['5.7254', '8.5882', '11.4509'],
    ['4.4', '6.6', '8.8'], ['0.2126', '0.2658', '0.3189'],
  ]
  for (let index = 0; index < synchronousConstants.length; index += 1) {
    const card = page.locator(`[data-constant="${synchronousConstants[index]}"]`)
    for (const [statIndex, stat] of ['minimum', 'average', 'maximum'].entries()) {
      await expect(card.locator(`[data-stat="${stat}"]`)).toContainText(expected[index][statIndex])
    }
    await expect(card).not.toContainText(/NaN|undefined/)
  }
})
