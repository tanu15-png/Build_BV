import { orderSections } from "../utils/orderRules";

export default function OrderSectionTabs({ selected, onChange, sections = orderSections }) {
  return <nav aria-label="Order sections" className="mt-6 flex gap-1 overflow-x-auto border-b">
    {sections.map(section => <button key={section} onClick={() => onChange(section)} aria-current={selected === section ? "page" : undefined} className={`shrink-0 border-b-2 px-3 py-3 text-sm font-bold sm:px-5 sm:text-base ${selected === section ? "border-[#287647] text-[#287647]" : "border-transparent text-gray-500"}`}>{section}</button>)}
  </nav>;
}
