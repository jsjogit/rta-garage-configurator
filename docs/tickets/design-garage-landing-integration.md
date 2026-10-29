# Jira draft — Design: integrate the Garage Wall Planner into /garage-cabinets

**Type:** Story (Design) · **Component:** Garage / Category pages · **Priority:** High
**Reporter:** Joshua Sjogren · **Labels:** garage-planner, ux-research, category-page

## Summary
Research and design how the Garage Wall Planner slides into the live `/garage-cabinets` landing page
seamlessly: where customers find it, how it opens, and how it hands back to the cart.

## Background
Stakeholders approved the Garage Wall Planner on 2026-10-29. A customer enters a wall length, ceiling
height, obstructions and a goal (Workbench, Max storage, A bit of both). The planner returns three priced,
buildable cabinet walls. Customers can edit them, see them in 3D and add the whole wall to the cart in one
click.

The approved demo used a prototype of the live page with three entry points. All three open the planner in
a slide-out drawer:
1. **Gallery pill:** "Design My Space" with a leading sparkle icon on the main product photo. It mirrors the
   kitchen pages' "Visualize in My Space" pill.
2. **Buy-box card:** "Design Your Own Garage Wall", between the 6-piece set card and the sample door.
3. **Feature block:** "Plan Your Whole Wall in Minutes", in the slot "The Invisible Difference" holds today.
   That block moves down one.

The prototype is a starting point, not a spec. It proves the planner fits on the page. It does not settle
how it should look in production.

## What we need from Design
**Research**
- Which entry points earn their place, and is three too many? Weigh the planner's prominence against the
  existing 6-piece set and sample-door conversions in the buy box.
- Choose between a slide-out on `/garage-cabinets` and a dedicated planner page. This is open with Hiten
  (tech lead). Engineering can build either; give a recommendation with rationale.
- Review precedents: the kitchen "Visualize in My Space" flow and competitor garage and closet planners.
- Plan to use existing funnel data (garage category, PDP, cart) and session recordings if available.

**Design**
- Entry-point components in the store's current design system: pill, buy-box card, feature block.
- The planner shell for desktop and mobile:
  - open, close and back behavior;
  - loading and error states, including "planner unavailable";
  - how the 3D pop-up layers over a slide-out.
- The hand-back: after "Add wall to cart", does the customer stay on the page, see a mini-cart, or go to the
  cart?
- Shared-design links: what a customer sees when opening `/garage-cabinets?design=K7M2QX` (slide-out) or
  `/garage/design/K7M2QX` (page).
- Analytics: name each entry point so we can measure which one drives `cart_add_all`.

## Acceptance criteria
- [ ] Written recommendation covering entry points (which, where, how many) and slide-out vs page, with
      rationale. Reviewed with Joshua and Hiten.
- [ ] Figma designs at desktop (1440) and mobile (390) for the chosen entry points and the planner shell,
      including the loading, error, add-to-cart and shared-link states.
- [ ] Uses the live page's tokens and components: fonts, `#e3dbcb` add-to-cart, `#2F3532` pills,
      1440px container. No new visual language.
- [ ] Accessibility: entry points are real buttons; the drawer traps focus, closes on Esc and returns focus
      to the CTA that opened it.
- [ ] Named entry-point events agreed with engineering.
- [ ] Hand-off notes for engineering. In nop each entry point is expected to be a small partial view.

## Out of scope
- Changes inside the planner itself (solver, editor, 3D). Flag anything you would change as a follow-up
  ticket.
- Copy and photography on the rest of the garage page.

## References
- Prototype: `prototype/garage-page.html` on branch `demo-2.0-1d` (rta-garage-configurator repo). Joshua
  can run it locally or share a screen recording.
- Live page: https://www.rtacabinetstore.com/garage-cabinets
- Decisions log: `docs/DECISIONS.md` (2026-10-27 nop architecture; 2026-10-29 prototype and approval).
- Attach: screenshots of the three prototype entry points and the open slide-out, desktop and mobile.
