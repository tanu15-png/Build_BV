export const portal = import.meta.env?.VITE_PORTAL || 'student';
export const apiBase = `/api/v1/${portal}`;

export const portalHome = role => role === 'student' ? '/dashboard' : `/${role}`;
export const roleLabel = role => ({ student: 'User', STUDENT: 'User', canteen: 'Canteen', CANTEEN: 'Canteen', admin: 'Admin', ADMIN: 'Admin' }[role] || role);
