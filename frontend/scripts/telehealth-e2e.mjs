import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(__dirname, '../test-results/telehealth')
const BASE = process.env.SHEBA_URL || 'http://127.0.0.1:5173'
const API = process.env.SHEBA_API || 'http://127.0.0.1:8080/api'

fs.mkdirSync(OUT, { recursive: true })

async function api(method, urlPath, token, body) {
  const res = await fetch(`${API}${urlPath}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`${method} ${urlPath}: ${json.error || res.status}`)
  return json.data
}

async function login(page, email, password) {
  await page.goto(`${BASE}/login`)
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForTimeout(1200)
}

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`)
  await page.screenshot({ path: file, fullPage: true })
  console.log('shot', name)
  return file
}

async function main() {
  console.log('=== API smoke: book + call ===')
  const patient = await api('POST', '/auth/login', null, {
    email: 'demo@sheba.com.bd',
    password: 'password123',
  })
  const doctor = await api('POST', '/auth/login', null, {
    email: 'doctor@sheba.com.bd',
    password: 'password123',
  })
  const doctors = await api('GET', '/doctors', null)
  const gp = doctors.find((d) => d.user_id === doctor.user.id) || doctors[0]
  const slots = await api('GET', `/doctors/${gp.user_id}/slots`, null)
  console.log('open slots', slots.length)

  const booked = await api('POST', '/appointments', patient.token, {
    doctor_id: gp.user_id,
    slot_id: slots[0]?.id,
    mode: 'video',
    reason: 'Scheduled fever check',
    reason_bn: 'জ্বর পরীক্ষা',
  })
  console.log('booked', booked.id, booked.status, booked.scheduled_at)

  const instant = await api('POST', '/appointments', patient.token, {
    doctor_id: gp.user_id,
    mode: 'phone',
    instant: true,
    reason: 'Urgent cough',
    reason_bn: 'জরুরি কাশি',
  })
  console.log('instant phone', instant.id, instant.status)

  const started = await api('POST', `/appointments/${instant.id}/start-call`, patient.token)
  console.log('ringing call', started.call.id, started.call.status)

  const incoming = await api('GET', '/doctor/incoming', doctor.token)
  console.log(
    'doctor sees calls',
    incoming.calls.map((c) => `${c.id}:${c.status}:${c.mode}`),
  )

  await api('POST', `/calls/${started.call.id}/answer`, doctor.token)
  await api('POST', `/calls/${started.call.id}/end`, doctor.token)
  console.log('API call lifecycle OK')

  console.log('=== Playwright dual-browser video ===')
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
    ],
  })

  const patientCtx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: OUT, size: { width: 1280, height: 800 } },
    permissions: ['camera', 'microphone'],
  })
  const doctorCtx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: OUT, size: { width: 1280, height: 800 } },
    permissions: ['camera', 'microphone'],
  })

  const patientPage = await patientCtx.newPage()
  const doctorPage = await doctorCtx.newPage()

  try {
    await login(patientPage, 'demo@sheba.com.bd', 'password123')
    await shot(patientPage, '01-patient-home')

    await patientPage.goto(`${BASE}/doctors`)
    await patientPage.waitForSelector('.doctor-card')
    await shot(patientPage, '02-doctors-list')

    // Book the seeded free GP explicitly (avoid flaky card order)
    await patientPage.goto(`${BASE}/doctors/${gp.user_id}`)
    await patientPage.waitForSelector('button:has-text("Start video now")')
    await shot(patientPage, '03-book-page')

    await patientPage.click('button:has-text("Video call")')
    await patientPage.fill('textarea', 'জ্বর ও কাশি — ভিডিও পরামর্শ চাই')
    await patientPage.click('button:has-text("Start video now")')
    await patientPage.waitForURL(/\/appointments\//, { timeout: 15000 })
    await shot(patientPage, '04-appointment-ready')

    await login(doctorPage, 'doctor@sheba.com.bd', 'password123')
    await doctorPage.goto(`${BASE}/doctor`)
    await shot(doctorPage, '05-doctor-desk')

    await patientPage.click('button:has-text("Start video call"), button:has-text("Join call")')
    await patientPage.waitForURL(/\/calls\//, { timeout: 15000 })
    await shot(patientPage, '06-patient-ringing')

    // doctor incoming banner OR join ready/ringing visit
    await doctorPage.waitForSelector(
      '[data-testid="doctor-incoming"], [data-testid="doctor-answer"], .case-row .btn-sm',
      { timeout: 20000 },
    )
    await shot(doctorPage, '07-doctor-incoming')
    if (await doctorPage.locator('[data-testid="doctor-answer"]').count()) {
      await doctorPage.click('[data-testid="doctor-answer"]')
    } else {
      await doctorPage.locator('.case-row .btn-sm').first().click()
    }
    await doctorPage.waitForURL(/\/calls\//, { timeout: 15000 })
    await shot(doctorPage, '08-doctor-call-room')

    const answerBtn = doctorPage.locator('[data-testid="answer-call"]')
    if (await answerBtn.count()) {
      await answerBtn.click()
      await doctorPage.waitForTimeout(1500)
    }
    await doctorPage.waitForTimeout(2000)
    await shot(doctorPage, '09-doctor-in-call')
    await shot(patientPage, '10-patient-in-call')

    await patientPage.waitForTimeout(2500)
    await patientPage.click('[data-testid="hangup"]')
    await patientPage.waitForTimeout(1000)
    await shot(patientPage, '11-after-hangup')

    // schedule slot booking too
    await patientPage.goto(`${BASE}/doctors/${gp.user_id}`)
    await patientPage.click('button:has-text("Phone call")')
    const slot = patientPage.locator('.slot-chip').first()
    if (await slot.count()) {
      await slot.click()
      await patientPage.click('button:has-text("Confirm booking")')
      await patientPage.waitForURL(/\/appointments\//, { timeout: 15000 })
      await shot(patientPage, '12-scheduled-slot')
    }

    await patientPage.goto(`${BASE}/appointments`)
    await shot(patientPage, '13-appointments-list')

    // phone instant call smoke
    await patientPage.goto(`${BASE}/doctors/${gp.user_id}`)
    await patientPage.click('button:has-text("Phone call")')
    await patientPage.click('button:has-text("Start phone now")')
    await patientPage.waitForURL(/\/appointments\//, { timeout: 15000 })
    await patientPage.click('button:has-text("Start phone call"), button:has-text("Join call")')
    await patientPage.waitForURL(/\/calls\//, { timeout: 15000 })
    await shot(patientPage, '14-phone-ringing')
    await doctorPage.goto(`${BASE}/doctor`)
    await doctorPage.waitForSelector('[data-testid="doctor-answer"], .case-row .btn-sm', {
      timeout: 20000,
    })
    if (await doctorPage.locator('[data-testid="doctor-answer"]').count()) {
      await doctorPage.click('[data-testid="doctor-answer"]')
    } else {
      await doctorPage.locator('.case-row .btn-sm').first().click()
    }
    await doctorPage.waitForURL(/\/calls\//, { timeout: 15000 })
    if (await doctorPage.locator('[data-testid="answer-call"]').count()) {
      await doctorPage.click('[data-testid="answer-call"]')
    }
    await shot(doctorPage, '15-phone-doctor')
    await patientPage.click('[data-testid="hangup"]')
    await shot(patientPage, '16-phone-done')

    console.log('UI flow OK')
  } catch (err) {
    await shot(patientPage, 'error-patient').catch(() => {})
    await shot(doctorPage, 'error-doctor').catch(() => {})
    console.error('UI FLOW FAILED', err)
    throw err
  } finally {
    const pVid = await patientPage.video()?.path()
    const dVid = await doctorPage.video()?.path()
    await patientCtx.close()
    await doctorCtx.close()
    await browser.close()
    if (pVid) {
      const dest = path.join(OUT, 'patient-flow.webm')
      fs.renameSync(pVid, dest)
      console.log('video', dest)
    }
    if (dVid) {
      const dest = path.join(OUT, 'doctor-flow.webm')
      fs.renameSync(dVid, dest)
      console.log('video', dest)
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
