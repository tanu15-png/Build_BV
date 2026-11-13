# Item and combo offers

Owners manage discounts at `/canteen/offers`, or attach/create/edit them in a banner's **Offers in this promotion** section. Percentage off, amount off and a fixed final price are supported. Values use integer paise; percentage values use basis points (1500 = 15%). Percentage discounts round down to the nearest paise. A discount never raises an item's price or produces a negative price.

Each offer has a required start and end in India time. The start is inclusive and the end exclusive. Enabled offers on the same menu item cannot overlap. Adjacent windows are allowed. Menu items and combos share the same pricing system. Rewards remain token purchases and do not receive cash discounts.

Offers are shared definitions. Editing one from a banner updates its price everywhere. Banner edits and their new/changed offers save in one transaction. Removing a banner association or pausing/deleting a poster does not pause or delete the underlying offer. Enabled offers run on their own schedule, including when an associated poster is a draft or paused.

Students see an Offer badge, crossed-out normal price, effective price and end time. The Offers menu filter combines with category and search. Discounts apply automatically in the cart. Checkout verifies current server prices under the same canteen lock used for menu and offer changes. Quotes expire at the next offer boundary; changed prices are reported inline on the cart. Orders retain immutable original/effective unit-price and offer-name snapshots, even if the offer is deleted. Tokens are earned from collected orders' discounted totals.

The backend caches raw catalog records and calculates time-sensitive prices for each response. The browser's cached catalog expires at the next offer start/end and schedules a refresh at that boundary. Existing catalog events invalidate caches after owner edits. Checkout always reads current database records.

The dashboard shows only the selected banner's compact menu strip. It follows swipes, arrows and dots; it does not rotate automatically. Mobile uses the same complete poster scaled to screen width.

After migrations, run `node --env-file-if-exists=.env --import tsx src/cli/check-offers.ts` from `backend` to verify live permissions, discounted cart pricing, quote expiry, banner associations, order snapshots and token totals. All verification records are rolled back; no offers are published to the real menu.
