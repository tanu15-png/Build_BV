import { campusDay } from '@spoonate/portal/utils/orderRules';

export default function SummaryDayPicker({ day, onChange }) {
  return <div className="flex flex-wrap items-end gap-3">
    <label className="text-sm font-bold">Summary date (IST)<input type="date" required value={day} onChange={event => { if (event.target.value) onChange(event.target.value); }} className="mt-2 block rounded-xl border border-gray-200 bg-white px-4 py-3" /></label>
    <button type="button" onClick={() => onChange(campusDay(new Date()))} className="rounded-xl border bg-white px-4 py-3 font-bold text-[#075d50]">Today</button>
  </div>;
}
