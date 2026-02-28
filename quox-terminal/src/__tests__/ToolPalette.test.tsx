import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ToolPalette from "../components/tools/ToolPalette";

describe("ToolPalette", () => {
  it("renders with header and search", () => {
    render(<ToolPalette onClose={vi.fn()} onExecute={vi.fn()} />);

    expect(screen.getByText("Tools")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search tools...")).toBeInTheDocument();
  });

  it("renders tool categories", () => {
    render(<ToolPalette onClose={vi.fn()} onExecute={vi.fn()} />);

    expect(screen.getByText("Fleet & Infrastructure")).toBeInTheDocument();
    expect(screen.getByText("Operations & Deployment")).toBeInTheDocument();
    expect(screen.getByText("AI & Chat")).toBeInTheDocument();
    expect(screen.getByText("Monitoring & Health")).toBeInTheDocument();
  });

  it("renders tool names", () => {
    render(<ToolPalette onClose={vi.fn()} onExecute={vi.fn()} />);

    expect(screen.getByText("Fleet List")).toBeInTheDocument();
    expect(screen.getByText("Platform Health")).toBeInTheDocument();
    expect(screen.getByText("Who Am I")).toBeInTheDocument();
  });

  it("calls onClose when close button clicked", () => {
    const onClose = vi.fn();
    render(<ToolPalette onClose={onClose} onExecute={vi.fn()} />);

    fireEvent.click(screen.getByTitle("Close"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onExecute for tools without params", () => {
    const onExecute = vi.fn();
    render(<ToolPalette onClose={vi.fn()} onExecute={onExecute} />);

    // Fleet List has no params — clicking should call onExecute immediately
    fireEvent.click(screen.getByTitle("Fleet List: List all fleet agents"));
    expect(onExecute).toHaveBeenCalledOnce();
    expect(onExecute).toHaveBeenCalledWith("quox fleet list");
  });

  it("opens param modal for tools with params", () => {
    render(<ToolPalette onClose={vi.fn()} onExecute={vi.fn()} />);

    // Deploy Service has params
    fireEvent.click(
      screen.getByTitle("Deploy Service: Deploy a service to the fleet"),
    );
    expect(screen.getByTestId("tool-param-modal")).toBeInTheDocument();
  });

  it("filters tools by search query", () => {
    render(<ToolPalette onClose={vi.fn()} onExecute={vi.fn()} />);

    const input = screen.getByPlaceholderText("Search tools...");
    fireEvent.change(input, { target: { value: "bastion" } });

    // Should show bastion-related tools
    expect(screen.getByText("Bastion Exec")).toBeInTheDocument();
    expect(screen.getByText("Bastion Status")).toBeInTheDocument();
    expect(screen.getByText("Bastion TUI")).toBeInTheDocument();

    // Should NOT show unrelated tools
    expect(screen.queryByText("Fleet List")).not.toBeInTheDocument();
  });

  it("shows empty state when search has no matches", () => {
    render(<ToolPalette onClose={vi.fn()} onExecute={vi.fn()} />);

    const input = screen.getByPlaceholderText("Search tools...");
    fireEvent.change(input, { target: { value: "xyznonexistent" } });

    expect(screen.getByText(/No tools match/)).toBeInTheDocument();
  });

  it("collapses and expands categories", () => {
    render(<ToolPalette onClose={vi.fn()} onExecute={vi.fn()} />);

    // Fleet List should be visible initially
    expect(screen.getByText("Fleet List")).toBeInTheDocument();

    // Click the category header to collapse
    fireEvent.click(screen.getByText("Fleet & Infrastructure"));
    expect(screen.queryByText("Fleet List")).not.toBeInTheDocument();

    // Click again to expand
    fireEvent.click(screen.getByText("Fleet & Infrastructure"));
    expect(screen.getByText("Fleet List")).toBeInTheDocument();
  });

  describe("Suggested section", () => {
    it("renders suggested section when paneContext provided with SSH mode", () => {
      render(
        <ToolPalette
          onClose={vi.fn()}
          onExecute={vi.fn()}
          paneContext={{
            mode: "ssh",
            hostId: "root@docker01",
            connected: true,
          }}
        />,
      );

      expect(screen.getByTestId("tool-palette-suggested")).toBeInTheDocument();
      expect(
        screen.getByText("Suggested for root@docker01"),
      ).toBeInTheDocument();
    });

    it("hides suggested section when search is active", () => {
      render(
        <ToolPalette
          onClose={vi.fn()}
          onExecute={vi.fn()}
          paneContext={{
            mode: "ssh",
            hostId: "root@docker01",
            connected: true,
          }}
        />,
      );

      // Suggested section should be visible initially
      expect(screen.getByTestId("tool-palette-suggested")).toBeInTheDocument();

      // Type in search
      const input = screen.getByPlaceholderText("Search tools...");
      fireEvent.change(input, { target: { value: "fleet" } });

      // Suggested section should be hidden
      expect(
        screen.queryByTestId("tool-palette-suggested"),
      ).not.toBeInTheDocument();
    });

    it("does not render suggested section when paneContext is not provided", () => {
      render(<ToolPalette onClose={vi.fn()} onExecute={vi.fn()} />);

      expect(
        screen.queryByTestId("tool-palette-suggested"),
      ).not.toBeInTheDocument();
    });

    it("suggested tools are clickable and call onExecute", () => {
      const onExecute = vi.fn();
      render(
        <ToolPalette
          onClose={vi.fn()}
          onExecute={onExecute}
          paneContext={{
            mode: "local",
            hostId: "",
            connected: true,
          }}
        />,
      );

      // "Who Am I" should appear in suggestions for local mode (admin tool)
      // Find it in the suggested section and click
      const suggested = screen.getByTestId("tool-palette-suggested");
      const whoami = suggested.querySelector(
        '[title="Who Am I: Show current user identity"]',
      );
      expect(whoami).toBeTruthy();
      fireEvent.click(whoami!);
      expect(onExecute).toHaveBeenCalledWith("quox whoami");
    });
  });
});
