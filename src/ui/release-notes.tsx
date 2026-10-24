import Markdown from "react-markdown";

/** Release prose only: no embedded HTML, media or remote resource loading. */
export function ReleaseNotes({ notes }: { notes: string }) {
  return (
    <div className="release-markdown">
      <Markdown
        skipHtml
        allowedElements={[
          "h1", "h2", "h3", "h4", "h5", "h6", "p", "ul", "ol", "li",
          "strong", "em", "a", "code", "pre", "br", "hr", "blockquote",
        ]}
        urlTransform={(url) => /^https:\/\//i.test(url) ? url : ""}
        components={{
          h1: "h4", h2: "h5", h3: "h6", h4: "h6", h5: "h6", h6: "h6",
          a: ({ href, children }) => href
            ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
            : <>{children}</>,
        }}
      >
        {notes}
      </Markdown>
    </div>
  );
}
