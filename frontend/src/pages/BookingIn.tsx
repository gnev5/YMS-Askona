import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar, dateFnsLocalizer, SlotInfo, View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, addDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const locales = { ru };
const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
    getDay,
    locales,
});

interface Object {
    id: number;
    name: string;
    object_type: string;
}

interface Supplier {
    id: number;
    name: string;
}

interface Dock {
  id: number
  name: string
}

interface TimeSlot {
  id: number
  day_of_week: number
  start_time: string
  end_time: string
  capacity: number
  occupancy: number
  status: 'free' | 'partial' | 'full' | string
  dock_id?: number
}

interface EventItem {
  id: string
  title: string
  start: Date
  end: Date
  resource: TimeSlot
  availableDocks?: number[]
  resourceId?: number
}


import BookingModal from '../components/BookingModal';


const BookingIn: React.FC = () => {
    const [objects, setObjects] = useState<Object[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [docks, setDocks] = useState<Dock[]>([]);
    const [selectedObject, setSelectedObject] = useState<number | null>(null);
    const [selectedSupplier, setSelectedSupplier] = useState<number | null>(null);
    const [events, setEvents] = useState<EventItem[]>([]);
    const initialWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const [currentDate, setCurrentDate] = useState(new Date());
    const [currentView, setCurrentView] = useState<View>('week');
    const [range, setRange] = useState<{ start: Date, end: Date }>({ start: initialWeekStart, end: addDays(initialWeekStart, 6) });
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date; slotId: number; availableDocks?: number[] } | null>(null);


    useEffect(() => {
        const fetchObjects = async () => {
            const { data } = await axios.get<Object[]>(`${API_BASE}/api/objects`);
            setObjects(data.filter(o => o.object_type === 'warehouse'));
        };

        const fetchSuppliers = async () => {
            const { data } = await axios.get<Supplier[]>(`${API_BASE}/api/suppliers`);
            setSuppliers(data);
        };

        const fetchDocks = async () => {
            const { data } = await axios.get<Dock[]>(`${API_BASE}/api/docks/`);
            setDocks(data);
        };

        fetchObjects();
        fetchSuppliers();
        fetchDocks();
    }, []);

    const handleSearch = async (rangeOverride?: { start: Date; end: Date }, viewOverride?: View) => {
        if (!selectedObject || !selectedSupplier) {
            alert('Пожалуйста, выберите объект и поставщика');
            return;
        }

        const currentRange = rangeOverride || range;
        const viewMode = viewOverride || currentView;
        const from = format(currentRange.start, 'yyyy-MM-dd');
        const to = format(currentRange.end, 'yyyy-MM-dd');
        const { data } = await axios.get<TimeSlot[]>(`${API_BASE}/api/time-slots?from_date=${from}&to_date=${to}&object_id=${selectedObject}&supplier_id=${selectedSupplier}&booking_type=in`);
        const evts: EventItem[] = [];

        for (let d = new Date(currentRange.start); d <= currentRange.end; d = new Date(d.getTime() + 86400000)) {
            const dow = d.getDay() === 0 ? 6 : d.getDay() - 1;
            const daySlots = data.filter(s => s.day_of_week === dow);

            if (viewMode === 'day') {
                daySlots.forEach(slot => {
                    const [sh, sm] = slot.start_time.split(':').map(Number);
                    const [eh, em] = slot.end_time.split(':').map(Number);
                    const start = new Date(d);
                    start.setHours(sh, sm, 0, 0);
                    const end = new Date(d);
                    end.setHours(eh, em, 0, 0);

                    const title = `${slot.occupancy}/${slot.capacity}`;

                    evts.push({
                        id: `slot-${slot.id}-${d.toDateString()}`,
                        title,
                        start,
                        end,
                        resource: slot,
                        availableDocks: slot.dock_id ? [slot.dock_id] : [],
                        resourceId: slot.dock_id,
                    });
                });
            } else {
                const slotGroups = new Map<string, TimeSlot[]>();
                daySlots.forEach(slot => {
                    const timeKey = `${slot.start_time}-${slot.end_time}`;
                    if (!slotGroups.has(timeKey)) {
                        slotGroups.set(timeKey, []);
                    }
                    slotGroups.get(timeKey)!.push(slot);
                });

                slotGroups.forEach((slots, timeKey) => {
                    if (slots.length === 0) return;

                    const [sh, sm] = slots[0].start_time.split(':').map(Number);
                    const [eh, em] = slots[0].end_time.split(':').map(Number);
                    const start = new Date(d);
                    start.setHours(sh, sm, 0, 0);
                    const end = new Date(d);
                    end.setHours(eh, em, 0, 0);

                    const totalCapacity = slots.reduce((sum, slot) => sum + slot.capacity, 0);
                    const totalOccupancy = slots.reduce((sum, slot) => sum + slot.occupancy, 0);

                    let status: 'free' | 'partial' | 'full' = 'free';
                    if (totalOccupancy === 0) {
                        status = 'free';
                    } else if (totalOccupancy < totalCapacity) {
                        status = 'partial';
                    } else {
                        status = 'full';
                    }

                    const title = `${totalOccupancy}/${totalCapacity}`;

                    const combinedResource: TimeSlot = {
                        id: slots[0].id,
                        day_of_week: slots[0].day_of_week,
                        start_time: slots[0].start_time,
                        end_time: slots[0].end_time,
                        capacity: totalCapacity,
                        occupancy: totalOccupancy,
                        status,
                    };

                    const availableDocks = slots
                        .filter(slot => slot.occupancy < slot.capacity)
                        .map(slot => slot.dock_id)
                        .filter((id): id is number => typeof id === 'number');

                    evts.push({
                        id: `combined-${timeKey}-${d.toDateString()}`,
                        title,
                        start,
                        end,
                        resource: combinedResource,
                        availableDocks,
                    });
                });
            }
        }
        setEvents(evts);
    };

    const onSelectSlot = (slotInfo: SlotInfo) => {
        // Prefer selection on event; slot selection may have collisions, so use event match by start/end/resource if present
        const match = events.find(e => 
            e.start.getTime() === slotInfo.start.getTime() && 
            e.end.getTime() === slotInfo.end.getTime() &&
            (!slotInfo.resourceId || e.resourceId === slotInfo.resourceId)
        );
        if (match) openModalForEvent(match);
    };

    const openModalForEvent = (evt: EventItem) => {
        if (String(evt.resource.status).toLowerCase() === 'full') return;
        setSelectedSlot({
            start: evt.start,
            end: evt.end,
            slotId: evt.resource.id,
            availableDocks: evt.availableDocks
        });
        setIsModalOpen(true);
    };

    const handleBookingSuccess = () => {
        handleSearch();
    };

    const goToDate = (date: Date) => {
        setCurrentDate(date);
    };

    const onRangeChange = (r: any) => {
        if (Array.isArray(r) && r.length) {
            setRange({ start: r[0], end: r[r.length - 1] });
            if (selectedObject && selectedSupplier) handleSearch({ start: r[0], end: r[r.length - 1] }, currentView);
        } else if (r?.start && r?.end) {
            setRange({ start: r.start, end: r.end });
            if (selectedObject && selectedSupplier) handleSearch({ start: r.start, end: r.end }, currentView);
        }
    };

    const onViewChange = (v: View) => {
        setCurrentView(v);
        if (selectedObject && selectedSupplier) handleSearch(range, v);
    };

    const dayPropGetter = (date: Date) => {
        const today = new Date();
        const recommendedDate = addDays(today, 7);
        if (date.getDate() === recommendedDate.getDate() && date.getMonth() === recommendedDate.getMonth() && date.getFullYear() === recommendedDate.getFullYear()) {
            return {
                className: 'recommended-day',
            };
        }
        return {};
    };

    const eventPropGetter = (event: EventItem) => {
        const status = String(event.resource.status || '').toLowerCase();
        let bg = '#e6ffed';
        let border = '#22c55e';
        let cursor = 'pointer';
        let title = 'Свободно';

        if (status === 'partial') {
            bg = '#fff7e6';
            border = '#f59e0b';
            title = 'Частично занято';
        } else if (status === 'full') {
            bg = '#ffe6e6';
            border = '#ef4444';
            cursor = 'not-allowed';
            title = 'Нет свободных мест';
        }
        
        return {
            style: {
                backgroundColor: bg,
                borderLeft: `4px solid ${border}`,
                cursor: cursor,
                color: '#1e3a8a'
            },
            title: title
        };
    };

    return (
        <div>
            <h1>Вход/поставка</h1>
            <div className="form-grid">
                <div className="field">
                    <label>Объект</label>
                    <select
                        value={selectedObject || ''}
                        onChange={(e) => setSelectedObject(Number(e.target.value))}
                    >
                        <option value="" disabled>Выберите объект</option>
                        {objects.map((obj) => (
                            <option key={obj.id} value={obj.id}>
                                {obj.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="field">
                    <label>Поставщик</label>
                    <select
                        value={selectedSupplier || ''}
                        onChange={(e) => setSelectedSupplier(Number(e.target.value))}
                    >
                        <option value="" disabled>Выберите поставщика</option>
                        {suppliers.map((supplier) => (
                            <option key={supplier.id} value={supplier.id}>
                                {supplier.name}
                            </option>
                        ))}
                    </select>
                </div>
                <button onClick={handleSearch}>Запланировать поставку</button>
            </div>

            <div className="inline-actions" style={{ marginTop: 12 }}>
                <button className="btn-secondary" onClick={() => goToDate(new Date())}>Сегодня</button>
                <button className="btn-secondary" onClick={() => goToDate(addDays(new Date(), 1))}>Завтра</button>
                <button className="btn-secondary" onClick={() => goToDate(addDays(new Date(), 7))}>Через неделю</button>
            </div>

            <div className="calendar-shell" style={{ marginTop: 12 }}>
                <Calendar
                    localizer={localizer}
                    events={events}
                    startAccessor="start"
                    endAccessor="end"
                    style={{ height: 'calc(100vh - 340px)' }}
                    selectable
                    step={30}
                    timeslots={1}
                    views={['week', 'day']}
                    defaultView={'week' as any}
                    defaultDate={initialWeekStart}
                    date={currentDate}
                    view={currentView}
                    onNavigate={(newDate) => setCurrentDate(newDate)}
                    onSelectSlot={onSelectSlot}
                    onSelectEvent={openModalForEvent as any}
                    onRangeChange={onRangeChange as any}
                    onView={onViewChange as any}
                    resources={currentView === 'day' ? docks : undefined}
                    resourceIdAccessor="id"
                    resourceTitleAccessor="name"
                    dayPropGetter={dayPropGetter}
                    eventPropGetter={eventPropGetter}
                    culture="ru"
                />
            </div>
            <BookingModal
                isOpen={isModalOpen}
            onClose={() => {
                setIsModalOpen(false);
                setSelectedSlot(null);
            }}
            selectedSlot={selectedSlot}
            onBookingSuccess={handleBookingSuccess}
            selectedObject={selectedObject}
            prefillSupplierId={selectedSupplier}
        />
    </div>
);
};

export default BookingIn;
