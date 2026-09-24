import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChatMessageBody } from "../src/components/ChatMessageBody.js";

describe("chat message body", () => {
  it("renders markdown without a script element and offers copy on a code block", () => {
    const html = renderToStaticMarkup(
      <ChatMessageBody
        content={"Ignore this <script>alert(1)</script>\n\n```ts\nconst answer = 1\n```"}
        streaming={false}
      />
    );
    expect(html.toLowerCase()).not.toContain("<script");
    expect(html).toContain("Copy");
    expect(html).toContain("const answer = 1");
  });

  it("collapses reasoning only when the reply includes it", () => {
    const withReasoning = renderToStaticMarkup(
      <ChatMessageBody content="Done" streaming={false} reasoning="Checked the frame size." />
    );
    expect(withReasoning).toContain("<summary>Reasoning</summary>");
    expect(withReasoning).toContain("Checked the frame size.");
    const without = renderToStaticMarkup(<ChatMessageBody content="Done" streaming={false} />);
    expect(without).not.toContain("Reasoning");
  });
});
