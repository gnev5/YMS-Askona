import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const pagePath = new URL('../src/pages/DataComparisons.tsx', import.meta.url)

assert.ok(app.includes("'data-comparisons'"), 'App Page union should include data-comparisons')
assert.ok(app.includes('DataComparisons'), 'App should import and render DataComparisons page')
assert.ok(app.includes('Сверка данных'), 'Navigation should show Сверка данных')
assert.ok(existsSync(pagePath), 'DataComparisons page should exist')

const page = readFileSync(pagePath, 'utf8')
assert.ok(page.includes('/api/data-comparisons/profiles'), 'Page should load comparison profiles')
assert.ok(page.includes('/api/data-comparisons/runs'), 'Page should create/list comparison runs')
assert.ok(page.includes('Дата с'), 'Page should let user choose only date_from')
assert.ok(page.includes('Дата по'), 'Page should let user choose only date_to')
assert.ok(page.includes('Профиль сверки'), 'Page should require profile selection')
assert.ok(page.includes('Создать профиль сверки'), 'Page should include profile creation form')
assert.ok(page.includes('/api/objects'), 'Page should load objects so users do not enter object_id blindly')
assert.ok(page.includes('Столбец с номером ТЛ'), 'Profile form should configure Excel column letter for TL')
assert.ok(page.includes('Строка начала'), 'Profile form should configure first data row')
assert.ok(page.includes('Строка окончания'), 'Profile form should configure last data row')
assert.ok(page.includes('/api/data-comparisons/profiles'), 'Profile form should save profiles via API')
assert.ok(page.includes('found_in_yms_extended_period'), 'Page should show ±2 days diagnostic status')
