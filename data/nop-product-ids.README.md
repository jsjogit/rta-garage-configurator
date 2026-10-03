# nop-product-ids.json

SKU to nopCommerce product id, e.g.

    { "MV-B24-F": 1234, "MV-CTHW7425": 5678 }

nopCommerce adds to cart by integer product id; the solver only knows SKUs. Until this map covers
every SKU in a layout, POST /api/cart returns ready=false and lists the missing SKUs, and adds
nothing — a half-added wall is worse than one that did not go in.
