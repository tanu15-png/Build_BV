# Supplied canteen menus

These transcriptions contain 1,503 clearly priced items in 175 categories across six supplied PDFs. Prices in the text files are rupees; the importer stores integer paise in the existing MenuItem table. Category headers record the original PDF page. `sources.json` records the original file hashes.

Bella Bite's main booklet takes precedence wherever readable; its separate leaflet supplies additional items and obscured prices. Fun 'N' Frolic's legible handwritten corrections take precedence over its duplicate printed chart. Unlabelled price choices retain their printed price without inventing a serving size. `needs-prices.json` lists 34 entries excluded because prices are missing or unreadable, as requested.

Run `npm run menus:preview` from the backend directory to inspect changes, then `npm run menus:import` to apply them. Applying saves a snapshot in the ignored `.import-backups/` directory first. Each canteen import is transactional and audited. Existing matching items are updated, unrelated manual items are retained, and old order snapshots are unaffected. Replaying an identical manifest skips it so later canteen edits are preserved. An intentionally changed manifest can update matching names again; review its preview before applying.

Imported items use the same categories, availability controls, price fields and menu editor as manually created items. No database schema migration is required. Posters live in the shared portal's public/canteens directory and are matched by canteen slug. Annapurna received a poster only because no menu was supplied for it. Mukteshwari was added from its later supplied 11-page menu; its clipped Masala Papad price is excluded.

