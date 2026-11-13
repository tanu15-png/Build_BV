# Promotional banners and special menus

The student carousel shows one full poster at a time, newest published first. It supports swipe, arrow and dot navigation with no automatic sliding. Images use their original aspect ratio and shrink to the screen width, without cropping or a separate mobile image.

The canteen dashboard previews the Exam Season, Sunday Funday and Birthday menus. Manage banners at `/canteen/banners`: upload a PNG/JPEG/WebP, edit title/description, select existing menu items, select the tap destination, schedule, publish/pause or delete. Tap destinations support the themed menu, the whole menu, an individual item/combination, or a menu category. Students can add items directly from `/dashboard/specials/:id` at current menu prices. No automatic discount or birthday verification is applied.

Three generated banners are published with six existing menu items each. Their selections remain owner-editable. `npm --prefix backend run banners:seed` adds missing default themes without overwriting existing banners. `npm --prefix backend run banners:check` verifies publication and image-storage permissions with rollback of its test record.

## Artwork

Generated using the built-in `image_gen` tool; all project assets are saved in the workspace:

- `packages/portal/public/banners/exam-season-v1.png`
- `packages/portal/public/banners/sunday-funday-v1.png`
- `packages/portal/public/banners/birthday-v1.png`
- Exact generation prompts: `packages/portal/public/banners/generation-prompts.json`

## Persistence and permissions

Apply `20261113000300_promotional_banners` before use. Banner definitions and menu links are stored in PostgreSQL. Uploaded poster bytes are also stored durably in PostgreSQL and served through `/api/v1/<portal>/banners/images/:id`, so no filesystem persistence or additional storage credentials are required. The application database role has RLS policies; browser roles have no direct access. Only authenticated canteen staff can modify banners/upload images, and menu links are constrained to that canteen.

Client uploads are compressed to WebP without cropping; upload requests are limited to 4 MB. The frontend proxy permits 5 MB. Uploaded images use immutable UUID URLs; generated posters use versioned URLs. Public banner reads have a short five-second cache; committed changes invalidate reads and notify connected dashboards. No separate mobile-image field exists.

## Verification

API tests cover publication/schedule filtering, staff-only raster uploads, unsafe-image rejection and foreign-menu rejection. Navigation tests cover menu, item/combination, category and themed-menu targets. Both frontend builds and the public API/image-storage checks are verified. A native browser visual inspection could not run because its access approval timed out.
