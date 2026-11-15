export const isComboCategory = name => /(^|\s)combos?$/i.test(String(name || '').trim());
