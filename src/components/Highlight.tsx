import React from 'react';
import JsonView from "@uiw/react-json-view";
import { vscodeTheme } from '@uiw/react-json-view/vscode';

interface HighlightProps {
  text?: string;
  object?: any;
  searchTerm: string;
}

export const Highlight: React.FC<HighlightProps> = ({ text, object, searchTerm }) => {
  if (object) {
    return (
      <JsonView
        value={object}
        collapsed={4}
        shortenTextAfterLength={2000}
        style={{ ...vscodeTheme, fontSize: "1.15em" }}
        displayDataTypes={false}
      />
    );
  }

  if (!text) return null;

  const parts = text.split(new RegExp(`(${searchTerm})`, 'gi'));
  return (
    <pre className="whitespace-pre-wrap text-white" style={{ fontSize: "1.1em", padding: "1em", borderRadius: "0.5em" }}>
      {parts.map((part, i) => 
        part.toLowerCase() === searchTerm.toLowerCase() ? 
          <mark key={i} className="bg-yellow-300 text-black">{part}</mark> : 
          part
      )}
    </pre>
  );
};