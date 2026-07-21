import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const myBookingsPage = readFileSync(new URL('../src/pages/MyBookings.tsx', import.meta.url), 'utf8')

assert.ok(myBookingsPage.includes('ID бронирования'), 'My bookings table should show booking ID column')
assert.ok(myBookingsPage.includes('/api/bookings/export/xlsx'), 'My bookings export should use XLSX export API')
assert.ok(myBookingsPage.includes('filteredBookings.map(b => b.id)'), 'My bookings export should include filtered booking IDs')
assert.ok(myBookingsPage.includes('MY_BOOKINGS_PAGE_SIZE'), 'My bookings table should paginate visible rows for faster rendering')
assert.ok(myBookingsPage.includes('pagedBookings.map'), 'My bookings table should render the current page instead of all rows')
assert.ok(myBookingsPage.includes('Для полной выгрузки Excel используются все отфильтрованные строки'), 'Pagination hint should explain that Excel export still uses all filtered rows')
