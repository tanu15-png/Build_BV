import { orderSections } from "../utils/orderRules";

export default function OrderSectionTabs({ selected, onChange, sections = orderSections }) {
  return <nav aria-label="Order sections" className="mt-6 flex flex-wrap gap-3 border-b">
    {sections.map(section => <button key={section} onClick={() => onChange(section)} aria-current={selected === section ? "page" : undefined} className={`border-b-2 px-5 py-3 font-bold ${selected === section ? "border-[#0f8f73] text-[#0f8f73]" : "border-transparent text-gray-500"}`}>{section}</button>)}
  </nav>;
}
