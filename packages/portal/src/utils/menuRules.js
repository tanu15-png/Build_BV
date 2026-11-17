export const isComboCategory = name => /(^|\s)combos?$/i.test(String(name || '').trim());

export const showMenuImage = item => !isComboCategory(item.category) || Boolean(item.imageRef && item.image);
