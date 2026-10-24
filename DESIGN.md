# Sonariel visual system

A music creator works at a Windows workstation with a dark editor and audio tools open. The dark workspace reduces glare; warm-gray recessed work surfaces distinguish reference details and system audit records.

The supplied Sonariel screens and later visual references define the primary direction. Use nearly black plum/graphite foundations, ivory ink, amber actions and restrained mint signals. Fine perimeter rules, square corners, dense modular layouts and a persistent player form the desktop shell. No promotional hero or webpage footer.

Typography: locally bundled Barlow for body and controls, Urbanist bold for headings and the original Sonariel wordmark, JetBrains Mono for numerical data, identifiers and logs. Fonts use their OFL licenses. Condensed density comes from compact headings, not tiny body copy.

Layout: 220px navigation rail, main scroll workspace, context panel when useful, fixed 88px player. Toolbars and panel headers remain consistent across projects, queue, library, environment and bridges. Buttons have 2px corners, cards at most 4px. Selected and focused states use amber. Mint means verified status; red is reserved for errors. Show stages and elapsed time when no real progress is available.

Interaction components are application-owned under `src/ui/`. Base UI 1.9 supplies unstyled behavior behind local contracts (side panel, selector, audio slider and workflow guide), not its own appearance. Keep every upstream import inside that adapter layer. Preserve the existing composition and tokens when upgrading primitives. Transitions are short, restrained and reduced-motion aware; focus/keyboard behavior must be tested independently of styling.

First-use guidance is a centered, optional six-step dialog with restrained framing and the same typography. Its thin amber progress track remains mounted across steps and interpolates with a 320 ms transform transition; it is secondary to the instructions. Completion and dismissal are remembered locally. The sidebar's Instruções do workflow button always reopens the guide, and both the dialog footer and dismissal reminder name that location explicitly. The tutorial describes the real workflow without creating demo projects or starting operations.

The sidebar version number opens a matching compact update dialog. An amber dot signals a new version without a forced popup. Automatic hourly/startup checks are optional; installation requires an explicit action. Distinguish a failed or absent check from a confirmed current version. The update dialog uses the same focus management and reduced-motion behavior as other dialogs.

The desktop titlebar is application-owned: 32px graphite strip, compact audio mark and Barlow label, muted technical caption, restrained window controls. The drag region is separate from the buttons; primary-button dragging and double-click maximize use explicit Tauri window commands. Minimize/restore/close remain accessible buttons. Browser previews disable these native controls rather than simulating success. Reserve the titlebar height above the existing shell and fixed player; do not reintroduce hidden content or body scrolling. Native Windows Snap hover menus are not provided by the HTML maximize button.
