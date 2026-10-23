# Sonariel interaction components

These are application-owned components, not a theme imported from a UI kit.

- `SidePanel`: controlled details panel, initial/return focus, modal keyboard containment and entry/exit transitions.
- `SelectControl`: string-valued selection, keyboard navigation, typeahead and portaled popup positioning.
- `AudioSlider`: controlled scalar audio value, pointer/keyboard interaction and human-readable accessible values.
- `WorkflowGuide`: six-step first-use dialog, replayable from the sidebar, with a continuous animated progress track and keyboard navigation. A versioned local WebView preference remembers completion or dismissal, without touching project data or invoking workflow operations. Its styling is local to `workflow-guide.css`.

The public props use React and plain application types. Only these implementation files import the pinned `@base-ui/react` subpaths. Screens must not import Base UI or depend on its compound component anatomy. Upstream fixes remain package updates rather than a vendored fork; replacing the interaction engine is localized here.

All visual decisions remain in `controls.css` and the existing product stylesheet. Colors, fonts, dimensions and framing come from Sonariel tokens. Entry/exit transitions are 150–180 ms and disabled with `prefers-reduced-motion`. Native HTML remains appropriate for simple text fields and buttons; the headless dependency supplies the more complex interaction behavior, not a wrapper around every element.

The DOM contract tests cover selection by keyboard, focus restoration/containment, Escape dismissal, slider values and disabled controls. jsdom platform adapters do not establish real layout or animation correctness; verify those in the installed desktop before a release.
