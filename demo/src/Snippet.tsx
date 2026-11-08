import snippets from "virtual:m2aitestkit-snippets";

/** A file from demo/snippets/, highlighted at build time. */
export const Snippet = ({ name, className }: { name: string; className?: string }) => (
  <div
    className={`snippet ${className ?? ""}`}
    dangerouslySetInnerHTML={{ __html: snippets[name] ?? "" }}
  />
);
