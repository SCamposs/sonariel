# Sonariel visual system

A music creator works at a Windows workstation with a dark editor and audio tools open. The dark workspace reduces glare; warm-gray recessed work surfaces distinguish reference details and system audit records.

The supplied Sonariel screens and later visual references define the primary direction. Use nearly black plum/graphite foundations, ivory ink, amber actions and restrained mint signals. Fine perimeter rules, square corners, dense modular layouts and a persistent player form the desktop shell. No promotional hero or webpage footer.

Typography: locally bundled Barlow for body and controls, Urbanist bold for headings and the original Sonariel wordmark, JetBrains Mono for numerical data, identifiers and logs. Fonts use their OFL licenses. Condensed density comes from compact headings, not tiny body copy.

Layout: 220px navigation rail, main scroll workspace, context panel when useful, fixed 88px player. Toolbars and panel headers remain consistent across projects, queue, library, environment and bridges. Buttons have 2px corners, cards at most 4px. Selected and focused states use amber. Mint means verified status; red is reserved for errors. Show stages and elapsed time when no real progress is available.

Interaction components are application-owned under `src/ui/`. Base UI 1.9 supplies unstyled behavior behind three narrow local contracts (side panel, selector and audio slider), not its own appearance. Keep every upstream import inside that adapter layer. Preserve the existing composition and tokens when upgrading primitives. Transitions are short, restrained and reduced-motion aware; focus/keyboard behavior must be tested independently of styling.
