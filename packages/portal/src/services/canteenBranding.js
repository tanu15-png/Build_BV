const posters = new Set(['annapurna', 'mukteshwari', 'spicy-bites', 'bella-bite', 'shanu', 'fun-n-frolic', 'desi-jayka']);
export function canteenPoster(slug) { return posters.has(slug) ? `/canteens/${slug}.jpg` : '/food-placeholder.svg'; }
