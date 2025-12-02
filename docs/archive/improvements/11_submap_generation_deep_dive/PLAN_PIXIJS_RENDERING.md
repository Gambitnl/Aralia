
# Plan: Refactor Submap Rendering with PixiJS

## 1. Purpose

The goal of this improvement is to perform a major architectural refactor of the `SubmapPane`'s rendering layer. We will replace the current method of rendering hundreds of individual React `<div>` elements with a high-performance **WebGL-based canvas managed by the PixiJS library.**

This is a "better tool" for rendering that will:
1.  **Drastically Improve Performance**: Offloading rendering from the CPU (DOM manipulation) to the GPU (WebGL) will result in a much smoother experience, especially on lower-end devices.
2.  **Unlock Advanced Visual Effects**: A canvas-based approach is a prerequisite for implementing advanced graphics like dynamic lighting, particle effects (weather, spell effects), and smooth sprite animations, which are unfeasible with the current DOM-based system.
3.  **Future-Proof the Architecture**: Adopting a professional 2D rendering library aligns the project with industry standards for web-based games and graphical applications.

---

## 2. Implementation Plan

### Phase 1: Library Integration and Asset Preparation

**Goal:** Integrate PixiJS into the project and prepare the necessary image assets (spritesheets) for rendering.

-   [ ] **Integrate PixiJS Library**
    -   **File**: `index.html`
    -   **Action**: Add `pixi.js` to the `<script type="importmap">`.
    -   **Envisioned Code**:
        ```html
        <script type="importmap">
        {
          "imports": {
            ...
            "pixi.js": "https://esm.sh/pixi.js@^8.0.0", // Or latest version
            ...
          }
        }
        </script>
        ```

-   [ ] **Create Spritesheet Asset**
    -   **Action**: Create a single spritesheet image (e.g., `tileset.png`) that contains all the individual icons and textures needed for the submap (trees, rocks, water, paths, etc.).
    -   **File Structure**: Place the spritesheet and its corresponding JSON atlas (which defines the coordinates of each sprite within the sheet) in the `public/assets/` directory.
        -   `public/assets/sprites/submap_tileset.png`
        -   `public/assets/sprites/submap_tileset.json`

### Phase 2: Create the PixiJS Renderer Component

**Goal:** Build a dedicated React component that encapsulates all PixiJS logic.

-   [ ] **Create New File**: `src/components/SubmapRendererPixi.tsx`
-   **Envisioned Code Content**:
    ```tsx
    // src/components/SubmapRendererPixi.tsx
    import React, { useEffect, useRef } from 'react';
    import * as PIXI from 'pixi.js';
    
    interface SubmapRendererPixiProps {
      proceduralData: any; // The output from useSubmapProceduralData
      // ... other props like player position, dimensions ...
    }
    
    const SubmapRendererPixi: React.FC<SubmapRendererPixiProps> = ({ proceduralData }) => {
      const canvasRef = useRef<HTMLDivElement>(null);
      const appRef = useRef<PIXI.Application | null>(null);

      // Effect to initialize the PixiJS application and load assets
      useEffect(() => {
        if (canvasRef.current && !appRef.current) {
          // 1. Create the Pixi App
          const app = new PIXI.Application({ ... });
          appRef.current = app;
          canvasRef.current.appendChild(app.view as HTMLCanvasElement);

          // 2. Load the spritesheet
          PIXI.Assets.load('/assets/sprites/submap_tileset.json').then((sheet) => {
            // Textures are now loaded and available in sheet.textures
            // Trigger an initial render of the map
            renderMap(proceduralData, sheet.textures);
          });
        }
        
        return () => {
          // Cleanup on unmount
          appRef.current?.destroy(true, true);
          appRef.current = null;
        };
      }, []);

      // Effect to re-render the map when data changes (e.g., player moves)
      useEffect(() => {
        if (appRef.current && PIXI.Assets.get('/assets/sprites/submap_tileset.json')) {
          renderMap(proceduralData, PIXI.Assets.get('/assets/sprites/submap_tileset.json').textures);
        }
      }, [proceduralData]);

      // The main rendering function
      const renderMap = (data, textures) => {
        const container = appRef.current.stage;
        container.removeChildren(); // Clear the stage

        // Loop through the grid data from proceduralData
        // For each tile, create a PIXI.Sprite using the correct texture
        // from the loaded spritesheet and add it to the stage.
        // Example:
        // const tileSprite = new PIXI.Sprite(textures['grass_01.png']);
        // tileSprite.position.set(x * TILE_SIZE, y * TILE_SIZE);
        // container.addChild(tileSprite);
      };

      // The component itself only renders the container for the canvas
      return <div ref={canvasRef} />;
    };
    
    export default SubmapRendererPixi;
    ```

### Phase 3: Refactor `SubmapPane.tsx`

**Goal:** Repurpose `SubmapPane` as a container that manages data and renders the new PixiJS component instead of DOM elements.

-   [ ] **Modify `SubmapPane.tsx`**
    -   **Action**:
        1.  Remove all the DOM-based grid rendering logic (the large `.map()` loop).
        2.  Remove the `getTileVisuals` helper function and its related styling logic.
        3.  Import the new `SubmapRendererPixi` component.
        4.  In the return statement, render `<SubmapRendererPixi />` and pass the necessary data (the output of `useSubmapProceduralData`) as props.
    -   **Envisioned Code Direction**:
        ```tsx
        // In SubmapPane.tsx
        import SubmapRendererPixi from './SubmapRendererPixi';

        const SubmapPane: React.FC<SubmapPaneProps> = ({ /* ... */ }) => {
          // The data hook remains the same
          const proceduralData = useSubmapProceduralData({ ... });

          return (
            <div className="submap-container ...">
              {/* ... Header, buttons, etc. remain the same ... */}

              <div className="grid-area">
                <SubmapRendererPixi
                  proceduralData={proceduralData}
                  playerSubmapCoords={playerSubmapCoords}
                  // Pass any other necessary data
                />
              </div>

              {/* ... Glossary, etc. remain the same ... */}
            </div>
          );
        };
        ```

## 3. Files Affected / Deprecated

-   **Files to be Modified**:
    -   `index.html` (to add `pixi.js` to the importmap)
    -   `src/components/SubmapPane.tsx` (major refactor)
-   **New Files**:
    -   `src/components/SubmapRendererPixi.tsx`
    -   `public/assets/sprites/submap_tileset.png`
    -   `public/assets/sprites/submap_tileset.json`
-   **Deprecated Files/Code**:
    -   The entire DOM-based grid rendering loop and associated styling/tooltip logic within `SubmapPane.tsx` will be deleted.

## 4. Risks and Mitigation

-   **Risk**: **High Complexity**. This is a major architectural shift. Integrating a rendering library into React requires careful management of the component lifecycle to avoid memory leaks or conflicts between React's declarative style and PixiJS's imperative API.
    -   **Mitigation**: The plan uses `useRef` to hold the PixiJS Application instance, which is the standard pattern for integrating imperative libraries. All PixiJS setup and teardown is contained within `useEffect` hooks to align with the React component lifecycle.
-   **Risk**: **Loss of Tooltip Functionality**. The existing React-based `Tooltip` component cannot be used on PixiJS objects.
    -   **Mitigation**: Interactivity (hover, click) must be re-implemented using PixiJS's event system. A new, canvas-based tooltip system would need to be created, or we could have the PixiJS canvas communicate with a React-based tooltip component that is absolutely positioned over the canvas. This is a non-trivial task.
-   **Risk**: **Initial Development Time**. The initial setup, asset preparation, and creation of the renderer component will take longer than modifying the existing DOM-based system.
    -   **Mitigation**: This is a trade-off for long-term performance and capability gains. The plan is structured to tackle this incrementally.
