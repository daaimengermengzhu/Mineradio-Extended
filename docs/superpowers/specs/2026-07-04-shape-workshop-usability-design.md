# Shape Workshop Usability Design

## Goal

Improve the custom shape workshop from "3D is visible" to "basic editing is usable". The first usability pass focuses on layout, visibility, selection, and slider-based editing.

## Scope

- Keep the real Three.js preview path introduced for custom shapes.
- Prevent the right control panel from covering the 3D workbench.
- Move selected-layer parameters near the top of the workshop so slider editing is immediately available.
- Make sliders larger and smoother for continuous tuning.
- Make newly added primitive layers more visible by default.
- Make the currently selected primitive layer visually stronger in both the list and the 3D preview.
- Add a lightweight edit gizmo on the 3D workbench for the selected layer: drag the center to edit X/Y position, drag the top handle to edit layer rotation.

## Non-Goals

- Do not implement a full 3D transform gizmo with depth dragging, scale boxes, snapping, or multi-select.
- Do not add arbitrary JavaScript or shader editing.
- Do not redesign the whole visual control panel.

## Interaction Model

Users add primitives from the library, select a layer from the layer list, and tune it with prominent sliders for position, particle count, size, depth, rotation, audio follow, and opacity. The Three.js preview updates while sliders move.

For the highest-frequency edits, the left workbench shows an edit gizmo for the selected layer. Dragging the center updates left/right and up/down. Dragging the top rotation handle updates layer angle. The gizmo is an editing control only; it must not become a fake 2D preview of the particle layer.

## Validation

- Verify the workshop opens without panel overlap at the current desktop viewport.
- Verify adding `point`, `ring`, or `spiral` produces clearly visible particles.
- Verify dragging sliders updates the visible 3D preview without console errors.
- Verify the workbench gizmo appears after adding/selecting a layer.
- Verify dragging the center changes the selected primitive `x` / `y` values.
- Verify dragging the rotation handle changes the selected primitive `rotation` value and refreshes the right-side slider value after release.
- Run the shape wiring check, server syntax check, and whitespace diff check.
