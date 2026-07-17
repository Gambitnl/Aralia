import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import BattleMapTile from "../BattleMapTile";
import { BattleMapTile as BattleMapTileData } from "../../../types/combat";

/**
 * These tests protect the smallest 2D battle-map tile renderer.
 *
 * Spell and visibility systems feed this component presentation flags such as
 * "valid move", "targetable", and now "hidden/dim/dark/bright". The tests keep
 * those visual states from silently disappearing while larger combat-map tests
 * remain expensive or renderer-specific.
 */

describe("BattleMapTile", () => {
  const mockOnTileClick = vi.fn();

  const mockTile: BattleMapTileData = {
    id: "0-0",
    coordinates: { x: 0, y: 0 },
    terrain: "grass",
    elevation: 0,
    movementCost: 1,
    blocksMovement: false,
    blocksLoS: false,
    decoration: null,
    environmentalEffects: [],
    effects: [],
  };

  it("renders correctly", () => {
    render(
      <BattleMapTile
        tile={mockTile}
        isValidMove={false}
        isInPath={false}
        isTargetable={false}
        isAoePreview={false}
        isTeleportDestinationPreview={false}
        targetingMode={false}
        onTileClick={mockOnTileClick}
      />,
    );

    // The tile itself is transparent (the painted ground canvas shows through);
    // terrain is conveyed by a faint tint layer using the deep forest-green tone.
    const tileElement = screen.getByRole("button", {
      name: "Tile grass at 0, 0, 0 ft above this map's lowest ground",
    });
    expect(tileElement).toBeInTheDocument();
    expect(
      tileElement.querySelector(".bg-\\[\\#1c3524\\]"),
    ).toBeInTheDocument();
    expect(tileElement).toHaveAttribute(
      "title",
      expect.stringContaining(
        "(0, 0) - grass - 0 ft above this map's lowest ground - Lowest ground on this map = 0 ft - bright",
      ),
    );
  });

  it("calls onTileClick with the tile object when clicked", () => {
    mockOnTileClick.mockClear();
    render(
      <BattleMapTile
        tile={mockTile}
        isValidMove={true}
        isInPath={false}
        isTargetable={false}
        isAoePreview={false}
        isTeleportDestinationPreview={false}
        targetingMode={false}
        onTileClick={mockOnTileClick}
      />,
    );

    const tileElement = screen.getByRole("button", {
      name: "Tile grass at 0, 0, 0 ft above this map's lowest ground",
    });
    fireEvent.click(tileElement);

    expect(mockOnTileClick).toHaveBeenCalledTimes(1);
    expect(mockOnTileClick).toHaveBeenCalledWith(mockTile);
  });

  it("forwards otherwise illegal tile clicks while targeting so validation can explain rejection", () => {
    mockOnTileClick.mockClear();
    render(
      <BattleMapTile
        tile={mockTile}
        isValidMove={false}
        isInPath={false}
        isTargetable={false}
        isAoePreview={false}
        isTeleportDestinationPreview={false}
        targetingMode={true}
        onTileClick={mockOnTileClick}
      />,
    );

    const tileElement = screen.getByRole("button", {
      name: "Tile grass at 0, 0, 0 ft above this map's lowest ground",
    });
    fireEvent.click(tileElement);

    // Invalid Misty Step destinations and other rejected spell targets are
    // explained by the selection hook. The tile must therefore pass the click
    // through while targeting, even when it is not highlighted as legal.
    expect(mockOnTileClick).toHaveBeenCalledTimes(1);
    expect(mockOnTileClick).toHaveBeenCalledWith(mockTile);
    expect(tileElement).toHaveAttribute("aria-disabled", "false");
  });

  it("shows overlay for valid move", () => {
    render(
      <BattleMapTile
        tile={mockTile}
        isValidMove={true}
        isInPath={false}
        isTargetable={false}
        isAoePreview={false}
        isTeleportDestinationPreview={false}
        targetingMode={false}
        onTileClick={mockOnTileClick}
      />,
    );
    // Movement keeps a precise interactive cell, but its interior wash stays
    // deliberately quiet because the perimeter is the primary distance cue.
    const overlay = screen.getByTestId("tile-interaction-overlay");
    expect(overlay).toHaveAttribute("data-overlay-kind", "move-range");
    expect(overlay).toHaveClass("bg-emerald-400/[0.07]");
    expect(overlay).not.toHaveClass("bg-emerald-400/20");
  });

  it("shows a strong mask for hidden visibility tiles", () => {
    const { container } = render(
      <BattleMapTile
        tile={mockTile}
        isValidMove={false}
        isInPath={false}
        isTargetable={false}
        isAoePreview={false}
        isTeleportDestinationPreview={false}
        isVisible={false}
        lightLevel="darkness"
        targetingMode={false}
        onTileClick={mockOnTileClick}
      />,
    );

    // Hidden tiles stay on the grid and report 'hidden'; the visual darkening
    // itself now lives in BattleMapFogCanvas (soft feathered fog), so the tile
    // must NOT render its own per-tile mask div anymore.
    expect(
      screen.getByRole("button", {
        name: "Tile grass at 0, 0, 0 ft above this map's lowest ground",
      }),
    ).toHaveAttribute(
      "title",
      expect.stringContaining(
        "(0, 0) - grass - 0 ft above this map's lowest ground - Lowest ground on this map = 0 ft - hidden",
      ),
    );
    expect(container.querySelector(".bg-black\\/55")).not.toBeInTheDocument();
  });

  it("shows a softer mask for dim visible tiles", () => {
    const { container } = render(
      <BattleMapTile
        tile={mockTile}
        isValidMove={false}
        isInPath={false}
        isTargetable={false}
        isAoePreview={false}
        isTeleportDestinationPreview={false}
        isVisible={true}
        lightLevel="dim"
        targetingMode={false}
        onTileClick={mockOnTileClick}
      />,
    );

    // Dim tiles report 'dim' in their tooltip; the dim-light wash is drawn by
    // BattleMapFogCanvas now, so no per-tile mask div should render.
    expect(
      screen.getByRole("button", {
        name: "Tile grass at 0, 0, 0 ft above this map's lowest ground",
      }),
    ).toHaveAttribute(
      "title",
      expect.stringContaining(
        "(0, 0) - grass - 0 ft above this map's lowest ground - Lowest ground on this map = 0 ft - dim",
      ),
    );
    expect(
      container.querySelector(".bg-slate-950\\/15"),
    ).not.toBeInTheDocument();
  });

  it("shows a short cover badge when cover labels are enabled", () => {
    const halfCoverTile: BattleMapTileData = {
      ...mockTile,
      id: "7-3",
      coordinates: { x: 7, y: 3 },
      terrain: "difficult",
      decoration: "bush",
      providesCover: true,
    };

    render(
      <BattleMapTile
        tile={halfCoverTile}
        isValidMove={false}
        isInPath={false}
        isTargetable={false}
        isAoePreview={false}
        isTeleportDestinationPreview={false}
        showCoverLabel
        targetingMode={false}
        onTileClick={mockOnTileClick}
      />,
    );

    // The cover sandbox needs the board itself to identify which tiles match
    // the sidebar rules, so the label should be visible without hovering.
    expect(screen.getByText("HC")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Tile difficult at 7, 3, half cover, 0 ft above this map's lowest ground",
      }),
    ).toBeInTheDocument();
  });

  it("replaces raw elevation units with feet relative to the active creature", () => {
    const raisedTile: BattleMapTileData = {
      ...mockTile,
      elevation: 20,
    };

    render(
      <BattleMapTile
        tile={raisedTile}
        isValidMove={false}
        isInPath={false}
        isTargetable={false}
        isAoePreview={false}
        isTeleportDestinationPreview={false}
        elevationReference={{ elevation: 10, label: "Dev" }}
        mapBaselineElevation={5}
        targetingMode={false}
        onTileClick={mockOnTileClick}
      />,
    );

    const tileElement = screen.getByRole("button", {
      name: "Tile grass at 0, 0, 10 ft higher than Dev",
    });
    expect(tileElement).toHaveAttribute("data-elevation-relation", "higher");
    expect(tileElement).toHaveAttribute("data-relative-elevation-feet", "10");
    expect(tileElement).not.toHaveAttribute(
      "title",
      expect.stringContaining("Elev:"),
    );
    expect(screen.getByTestId("tile-elevation-badge")).toHaveTextContent(
      "\u2191 10 ft",
    );
  });
});
