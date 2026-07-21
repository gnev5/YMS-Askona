import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const myBookingsPage = readFileSync(new URL('../src/pages/MyBookings.tsx', import.meta.url), 'utf8')

assert.ok(myBookingsPage.includes('ID бронирования'), 'My bookings table should show booking ID column')
assert.ok(myBookingsPage.includes('/api/bookings/export/xlsx'), 'My bookings export should use XLSX export API')
assert.ok(myBookingsPage.includes('filteredBookings.map(b => b.id)'), 'My bookings export should include filtered booking IDs')
