import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import TokenBudgetGauge from "../components/claude/TokenBudgetGauge";

describe("TokenBudgetGauge", () => {
  it("renders token counts", () => {
    render(
      <TokenBudgetGauge
        inputTokens={50000}
        outputTokens={10000}
      />,
    );
    expect(screen.getByText(/In: 50.0k/)).toBeInTheDocument();
    expect(screen.getByText(/Out: 10.0k/)).toBeInTheDocument();
  });

  it("renders total usage", () => {
    render(
      <TokenBudgetGauge
        inputTokens={50000}
        outputTokens={10000}
      />,
    );
    expect(screen.getByText(/60.0k/)).toBeInTheDocument();
  });

  it("shows free percentage", () => {
    render(
      <TokenBudgetGauge
        inputTokens={100000}
        outputTokens={60000}
      />,
    );
    // 160k / 200k = 80% used, 20% free
    expect(screen.getByText(/Free: 20%/)).toBeInTheDocument();
  });

  it("shows cache read tokens when provided", () => {
    render(
      <TokenBudgetGauge
        inputTokens={50000}
        outputTokens={10000}
        cacheReadTokens={5000}
      />,
    );
    expect(screen.getByText(/Cache: 5.0k/)).toBeInTheDocument();
  });

  it("does not show cache when zero", () => {
    render(
      <TokenBudgetGauge
        inputTokens={50000}
        outputTokens={10000}
        cacheReadTokens={0}
      />,
    );
    expect(screen.queryByText(/Cache:/)).not.toBeInTheDocument();
  });

  it("applies warning class at < 20% free", () => {
    const { container } = render(
      <TokenBudgetGauge
        inputTokens={160000}
        outputTokens={10000}
      />,
    );
    // 170k/200k = 85% used, 15% free → warning
    expect(
      container.querySelector(".token-gauge__bar--warning"),
    ).toBeTruthy();
  });

  it("applies critical class at < 10% free", () => {
    const { container } = render(
      <TokenBudgetGauge
        inputTokens={185000}
        outputTokens={10000}
      />,
    );
    // 195k/200k = 97.5% used, 2.5% free → critical
    expect(
      container.querySelector(".token-gauge__bar--critical"),
    ).toBeTruthy();
  });

  it("renders at zero tokens", () => {
    render(
      <TokenBudgetGauge
        inputTokens={0}
        outputTokens={0}
      />,
    );
    expect(screen.getByText(/Free: 100%/)).toBeInTheDocument();
  });
});
