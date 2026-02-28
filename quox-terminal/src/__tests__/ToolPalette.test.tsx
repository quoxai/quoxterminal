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
    expect(screen.getByText("Interactive TUI")).toBeInTheDocument();
    expect(screen.getByText("AI & Chat")).toBeInTheDocument();
    expect(screen.getByText("Monitoring & Health")).toBeInTheDocument();
    expect(screen.getByText("Admin & Config")).toBeInTheDocument();
    expect(screen.getByText("Organization")).toBeInTheDocument();
    expect(screen.getByText("Agents")).toBeInTheDocument();
    expect(screen.getByText("Assistants")).toBeInTheDocument();
  });

  it("renders tool names", () => {
    render(<ToolPalette onClose={vi.fn()} onExecute={vi.fn()} />);

    expect(screen.getByText("Fleet Status")).toBeInTheDocument();
    expect(screen.getByText("Service Health")).toBeInTheDocument();
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

    // Fleet Summary has no required params (output is optional) but has params
    // Who Am I has no params — clicking should call onExecute immediately
    fireEvent.click(screen.getByTitle("Who Am I: Show current user identity"));
    expect(onExecute).toHaveBeenCalledOnce();
    expect(onExecute).toHaveBeenCalledWith("quox whoami");
  });

  it("opens param modal for tools with params", () => {
    render(<ToolPalette onClose={vi.fn()} onExecute={vi.fn()} />);

    // Memory Search has a required --query param
    fireEvent.click(
      screen.getByTitle("Memory Search: Search memories by query"),
    );
    expect(screen.getByTestId("tool-param-modal")).toBeInTheDocument();
  });

  it("filters tools by search query", () => {
    render(<ToolPalette onClose={vi.fn()} onExecute={vi.fn()} />);

    const input = screen.getByPlaceholderText("Search tools...");
    fireEvent.change(input, { target: { value: "fleet" } });

    // Should show fleet-related tools
    expect(screen.getByText("Fleet Status")).toBeInTheDocument();
    expect(screen.getByText("Fleet Summary")).toBeInTheDocument();

    // Should NOT show unrelated tools
    expect(screen.queryByText("Who Am I")).not.toBeInTheDocument();
  });

  it("filters tools by tags", () => {
    render(<ToolPalette onClose={vi.fn()} onExecute={vi.fn()} />);

    const input = screen.getByPlaceholderText("Search tools...");
    fireEvent.change(input, { target: { value: "diagnostic" } });

    // Tools tagged "diagnostic" should appear
    expect(screen.getByText("Service Health")).toBeInTheDocument();
    expect(screen.getByText("Memory Stats")).toBeInTheDocument();
  });

  it("shows empty state when search has no matches", () => {
    render(<ToolPalette onClose={vi.fn()} onExecute={vi.fn()} />);

    const input = screen.getByPlaceholderText("Search tools...");
    fireEvent.change(input, { target: { value: "xyznonexistent" } });

    expect(screen.getByText(/No tools match/)).toBeInTheDocument();
  });

  it("collapses and expands categories", () => {
    render(<ToolPalette onClose={vi.fn()} onExecute={vi.fn()} />);

    // Fleet Status should be visible initially
    expect(screen.getByText("Fleet Status")).toBeInTheDocument();

    // Click the category header to collapse
    fireEvent.click(screen.getByText("Fleet & Infrastructure"));
    expect(screen.queryByText("Fleet Status")).not.toBeInTheDocument();

    // Click again to expand
    fireEvent.click(screen.getByText("Fleet & Infrastructure"));
    expect(screen.getByText("Fleet Status")).toBeInTheDocument();
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

      // "Quox TUI" should appear in suggestions for local mode (TUI tool)
      const suggested = screen.getByTestId("tool-palette-suggested");
      const quoxTui = suggested.querySelector(
        '[title="Quox TUI: Launch full interactive terminal UI"]',
      );
      expect(quoxTui).toBeTruthy();
      fireEvent.click(quoxTui!);
      expect(onExecute).toHaveBeenCalledWith("quox tui");
    });
  });
});
