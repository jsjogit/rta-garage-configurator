# Decisions log

| Date | Decision | Why |
|---|---|---|
| 2026-10-01 | Standalone repo; Core is a plain .NET library | Keeps solver testable and portable into the nopCommerce solution later |
| 2026-10-01 | SVG elevation in Phase 1, Three.js in Phase 2 | Ship guidance + add-all-to-cart first; 3D is polish |
| 2026-10-01 | Exclude RV-BWB18* inserts from solver | No 18" garage base exists; they are kitchen-line items |

## Needs Joshua
- Does 34.5" base height include legs? At what leg setting?
- BOM for MV-GARAGE-KIT-6.
- Can countertops be butted end-to-end?
- Default ceiling height assumption (96)?
- Which nopCommerce endpoint should "add entire wall" call? (bulk add vs. sequential)
- Where should config_id persistence live for Phase 1? (Azure Table Storage proposed)
