import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { chromium } from 'playwright'

function pickFirstNonEmptyOption(options) {
  return options.find((o) => o && o.value && o.value.trim().length > 0) || null
}

async function getSelectOptions(page, selector) {
  return await page.$$eval(`${selector} option`, (opts) =>
    opts.map((o) => ({ value: o.value, label: o.textContent || '' })),
  )
}

async function main() {
  const baseUrl = process.env.BASE_URL || 'http://localhost:5173/'

  const consoleErrors = []
  const pageErrors = []
  const debug = { screenshotPath: null, rootHtmlSnippet: null }
  const requestFailures = []

  const launchers = [
    () => chromium.launch({ channel: 'chrome', headless: true }),
    () => chromium.launch({ headless: true }),
  ]

  let browser = null
  let page = null
  let lastLaunchError = null

  try {
    for (const launch of launchers) {
      try {
        browser = await launch()
        break
      } catch (e) {
        lastLaunchError = e
      }
    }
    if (!browser) {
      throw new Error(
        `Failed to launch a browser via Playwright. Last error: ${String(
          lastLaunchError?.message || lastLaunchError,
        )}`,
      )
    }

    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    })
    page = await context.newPage()
    page.setDefaultTimeout(60_000)

  page.on('console', (msg) => {
    const type = msg.type()
    if (type === 'error') {
      consoleErrors.push(msg.text())
    }
  })
  page.on('pageerror', (err) => pageErrors.push(String(err)))
  page.on('requestfailed', (req) => {
    requestFailures.push({
      url: req.url(),
      failure: req.failure()?.errorText || 'unknown',
      method: req.method(),
      resourceType: req.resourceType(),
    })
  })
  page.on('dialog', async (dialog) => {
    // For Delete confirmation.
    await dialog.accept()
  })

    try {
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })

      // Wait for React to mount something into #root.
      await page.waitForFunction(() => {
        const root = document.querySelector('#root')
        return Boolean(root && root.children && root.children.length > 0)
      })

      // Basic presence checks
      await page.locator('h1.app-title').waitFor()
      await page.locator('#profile-form').waitFor()
      await page.locator('table.data-table').waitFor()
    } catch (e) {
      const outDir = path.join(process.cwd(), 'tmp')
      fs.mkdirSync(outDir, { recursive: true })
      const shot = path.join(outDir, `smoke-fail-${Date.now()}.png`)
      await page.screenshot({ path: shot, fullPage: true })
      debug.screenshotPath = shot
      debug.rootHtmlSnippet = await page.evaluate(() => {
        const root = document.querySelector('#root')
        const html = root ? root.innerHTML : ''
        return html.length > 4000 ? html.slice(0, 4000) + '…' : html
      })
      throw e
    }

  // Fill the form
  const firstName = 'Jay'
  const lastName = 'Mehta'
  const username = `jay${Date.now().toString().slice(-6)}`
  const email1 = `jay.${Date.now().toString().slice(-6)}@example.com`
  const email2 = `jay.updated.${Date.now().toString().slice(-6)}@example.com`

  await page.fill('#username', username)
  await page.fill('#firstName', firstName)
  await page.fill('#lastName', lastName)
  await page.fill('#email', email1)

  // Ensure country = India
  await page.selectOption('#country', { label: 'India' })

  // Upload avatar (hidden input)
  const avatarPngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/at8lZkAAAAASUVORK5CYII='
  const tmpAvatarPath = path.join(os.tmpdir(), `avatar-${Date.now()}.png`)
  fs.writeFileSync(tmpAvatarPath, Buffer.from(avatarPngBase64, 'base64'))
  await page.setInputFiles('input[type="file"][accept="image/*"]', tmpAvatarPath)

  // Pick first available state from the custom dropdown
  const stateField = page.locator('div.field-col-span-2', {
    has: page.locator('label[for="state"]'),
  })
  const stateTrigger = stateField.locator('div.form-input').first()
  await stateTrigger.waitFor()
  await page.waitForFunction(() => {
    const label = document.querySelector('label[for="state"]')
    const field = label ? label.closest('div') : null
    const trigger = field ? field.querySelector('div.form-input') : null
    const text = trigger ? trigger.textContent || '' : ''
    return trigger && !text.includes('Loading States')
  })
  await stateTrigger.click()

  const stateOption = page.locator('ul.state-dropdown li.state-option').first()
  await stateOption.waitFor()
  const stateName = (await stateOption.innerText()).trim()
  await stateOption.click()

  // District
  await page.locator('#district').waitFor({ state: 'visible' })
  await page.waitForFunction(() => {
    const el = document.querySelector('#district')
    if (!el) return false
    // @ts-ignore
    return !el.disabled
  })
  await page.waitForFunction(() => {
    const opts = document.querySelectorAll('#district option')
    return opts.length > 1
  })
  const districtOptions = await getSelectOptions(page, '#district')
  const districtPick = pickFirstNonEmptyOption(districtOptions)
  if (!districtPick) throw new Error('No district options loaded.')
  await page.selectOption('#district', districtPick.value)
  const districtName = districtPick.value

  // Pincode
  await page.waitForFunction(() => {
    const el = document.querySelector('#postal-code')
    if (!el) return false
    // @ts-ignore
    return !el.disabled
  })
  await page.waitForFunction(() => {
    const opts = document.querySelectorAll('#postal-code option')
    return opts.length > 1
  })
  const pincodeOptions = await getSelectOptions(page, '#postal-code')
  const pincodePick = pickFirstNonEmptyOption(pincodeOptions)
  if (!pincodePick) throw new Error('No pincode options loaded.')
  await page.selectOption('#postal-code', pincodePick.value)
  const pincode = pincodePick.value

  await page.fill('#streetAddress', '123 Test Street')

  // Save
  await page.locator('button.btn-save', { hasText: 'Save' }).waitFor()
  await page.click('button.btn-save')

  // Confirm new row appears
  const tbody = page.locator('table.data-table tbody')
  await page.waitForFunction(() => {
    const empty = document.querySelector('table.data-table tbody td.empty')
    return !empty
  })

  const row = tbody.locator('tr').first()
  await row.waitFor()

  // Validate key fields in row
  const fullNameCell = row.locator('td').nth(1)
  const emailCell = row.locator('td').nth(2)
  const countryCell = row.locator('td').nth(3)
  const stateCell = row.locator('td').nth(4)
  const districtCell = row.locator('td').nth(5)
  const pincodeCell = row.locator('td').nth(6)
  const usernameCell = row.locator('td').nth(7)
  const avatarImg = row.locator('img.avatar')

  const fullName = (await fullNameCell.innerText()).trim()
  const emailInTable = (await emailCell.innerText()).trim()
  const countryInTable = (await countryCell.innerText()).trim()
  const stateInTable = (await stateCell.innerText()).trim()
  const districtInTable = (await districtCell.innerText()).trim()
  const pincodeInTable = (await pincodeCell.innerText()).trim()
  const usernameInTable = (await usernameCell.innerText()).trim()

  if (fullName !== `${firstName} ${lastName}`) {
    throw new Error(`Full name mismatch: got "${fullName}"`)
  }
  if (emailInTable !== email1) throw new Error(`Email mismatch: got "${emailInTable}"`)
  if (countryInTable !== 'India') throw new Error(`Country mismatch: got "${countryInTable}"`)
  if (stateInTable !== stateName) throw new Error(`State mismatch: got "${stateInTable}" expected "${stateName}"`)
  if (districtInTable !== districtName) {
    throw new Error(`District mismatch: got "${districtInTable}" expected "${districtName}"`)
  }
  if (pincodeInTable !== pincode) throw new Error(`Pincode mismatch: got "${pincodeInTable}" expected "${pincode}"`)
  if (usernameInTable !== username) throw new Error(`Username mismatch: got "${usernameInTable}"`)
  await avatarImg.waitFor()

  // Filters: Country -> India, then State/District.
  await page.selectOption('#filter-country', { label: 'India' })
  await page.waitForFunction(() => {
    const el = document.querySelector('#filter-state')
    if (!el) return false
    // @ts-ignore
    return !el.disabled
  })
  await page.waitForFunction(() => {
    const opts = document.querySelectorAll('#filter-state option')
    return opts.length > 1
  })
  await page.selectOption('#filter-state', stateName)

  await page.waitForFunction(() => {
    const el = document.querySelector('#filter-district')
    if (!el) return false
    // @ts-ignore
    return !el.disabled
  })
  await page.waitForFunction(() => {
    const opts = document.querySelectorAll('#filter-district option')
    return opts.length > 1
  })
  await page.selectOption('#filter-district', districtName)

  // Update via 3-dots menu
  await row.locator('button.menu-btn').click()
  await page.locator('button.menu-item', { hasText: 'Update' }).click()

  // Form should switch to Update mode and prefill
  await page.locator('button.btn-save', { hasText: 'Update' }).waitFor()
  const prefillEmail = await page.inputValue('#email')
  const prefillUsername = await page.inputValue('#username')
  if (prefillEmail !== email1) throw new Error(`Prefill email mismatch: got "${prefillEmail}"`)
  if (prefillUsername !== username) throw new Error(`Prefill username mismatch: got "${prefillUsername}"`)

  // Change email then click Update
  await page.fill('#email', email2)
  await page.click('button.btn-save')

  // Confirm table row updates
  await page.waitForFunction(
    ({ nextEmail }) => {
      const cell = document.querySelector('table.data-table tbody tr td:nth-child(3)')
      return cell && cell.textContent && cell.textContent.trim() === nextEmail
    },
    { nextEmail: email2 },
  )

  // Delete row
  await page.locator('table.data-table tbody tr button.menu-btn').click()
  await page.locator('button.menu-item', { hasText: 'Delete' }).click()

  await page.waitForFunction(() => {
    const empty = document.querySelector('table.data-table tbody td.empty')
    return Boolean(empty)
  })

    await browser.close()

    return {
      ok: true,
      picked: { stateName, districtName, pincode },
      consoleErrors,
      pageErrors,
      requestFailures,
      debug,
    }
  } catch (err) {
    if (page && !debug.screenshotPath) {
      try {
        const outDir = path.join(process.cwd(), 'tmp')
        fs.mkdirSync(outDir, { recursive: true })
        const shot = path.join(outDir, `smoke-fail-${Date.now()}.png`)
        await page.screenshot({ path: shot, fullPage: true })
        debug.screenshotPath = shot
        debug.rootHtmlSnippet = await page.evaluate(() => {
          const root = document.querySelector('#root')
          const html = root ? root.innerHTML : ''
          return html.length > 4000 ? html.slice(0, 4000) + '…' : html
        })
      } catch {
        // ignore
      }
    }
    if (browser) await browser.close().catch(() => {})
    return {
      ok: false,
      error: String(err?.message || err),
      errorStack: String(err?.stack || ''),
      consoleErrors,
      pageErrors,
      requestFailures,
      debug,
    }
  }
}

const out = await main()
process.stdout.write(JSON.stringify(out, null, 2) + '\n')
process.exit(out.ok ? 0 : 1)

