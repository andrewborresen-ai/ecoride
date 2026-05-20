import React from "react";
import { View, Text, StyleSheet } from "react-native";

interface Props {
  content: string;
  textColor: string;
  mutedColor: string;
  borderColor: string;
  primaryColor: string;
  mutedBg: string;
}

type Block =
  | { type: "h1" | "h2" | "h3"; text: string }
  | { type: "hr" }
  | { type: "bullet"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "paragraph"; text: string }
  | { type: "blank" };

function parseBlocks(markdown: string): Block[] {
  const lines = markdown.split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    if (trimmed.startsWith("### ")) {
      blocks.push({ type: "h3", text: trimmed.slice(4).trim() });
      i++;
      continue;
    }

    if (trimmed.startsWith("## ")) {
      blocks.push({ type: "h2", text: trimmed.slice(3).trim() });
      i++;
      continue;
    }

    if (trimmed.startsWith("# ")) {
      blocks.push({ type: "h1", text: trimmed.slice(2).trim() });
      i++;
      continue;
    }

    if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    if (trimmed.startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i].trim());
        i++;
      }
      const nonSep = tableLines.filter((l) => !/^\|[-| :]+\|$/.test(l));
      if (nonSep.length >= 1) {
        const parseRow = (l: string) =>
          l
            .split("|")
            .slice(1, -1)
            .map((c) => c.trim());
        const headers = parseRow(nonSep[0]);
        const rows = nonSep.slice(1).map(parseRow);
        blocks.push({ type: "table", headers, rows });
      }
      continue;
    }

    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const items: string[] = [];
      while (
        i < lines.length &&
        (lines[i].trim().startsWith("- ") || lines[i].trim().startsWith("* "))
      ) {
        items.push(lines[i].trim().slice(2).trim());
        i++;
      }
      blocks.push({ type: "bullet", items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith("#") &&
      !lines[i].trim().startsWith("|") &&
      !lines[i].trim().startsWith("- ") &&
      !lines[i].trim().startsWith("* ") &&
      lines[i].trim() !== "---"
    ) {
      paragraphLines.push(lines[i].trim());
      i++;
    }
    if (paragraphLines.length) {
      blocks.push({ type: "paragraph", text: paragraphLines.join(" ") });
    }
  }

  return blocks;
}

function InlineText({
  text,
  color,
  size = 13,
  lineHeight = 20,
  mutedColor,
}: {
  text: string;
  color: string;
  size?: number;
  lineHeight?: number;
  mutedColor: string;
}) {
  const parts: { text: string; bold: boolean; italic: boolean }[] = [];
  const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|_(.+?)_)/g;
  let last = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      parts.push({ text: text.slice(last, match.index), bold: false, italic: false });
    }
    if (match[2]) parts.push({ text: match[2], bold: true, italic: true });
    else if (match[3]) parts.push({ text: match[3], bold: true, italic: false });
    else if (match[4]) parts.push({ text: match[4], bold: false, italic: true });
    else if (match[5]) parts.push({ text: match[5], bold: false, italic: true });
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    parts.push({ text: text.slice(last), bold: false, italic: false });
  }

  return (
    <Text style={{ fontSize: size, lineHeight, color }}>
      {parts.map((p, idx) => (
        <Text
          key={idx}
          style={{
            fontFamily: p.bold && p.italic
              ? "Inter_700Bold"
              : p.bold
              ? "Inter_700Bold"
              : p.italic
              ? "Inter_400Regular"
              : "Inter_400Regular",
            fontStyle: p.italic && !p.bold ? "italic" : "normal",
            color: p.bold ? color : p.italic ? mutedColor : color,
          }}
        >
          {p.text}
        </Text>
      ))}
    </Text>
  );
}

export default function MarkdownRenderer({
  content,
  textColor,
  mutedColor,
  borderColor,
  primaryColor,
  mutedBg,
}: Props) {
  const blocks = parseBlocks(content);

  return (
    <View>
      {blocks.map((block, idx) => {
        switch (block.type) {
          case "h1":
            return (
              <Text key={idx} style={[s.h1, { color: textColor, borderBottomColor: borderColor }]}>
                {block.text}
              </Text>
            );
          case "h2":
            return (
              <Text key={idx} style={[s.h2, { color: textColor }]}>
                {block.text}
              </Text>
            );
          case "h3":
            return (
              <Text key={idx} style={[s.h3, { color: textColor }]}>
                {block.text}
              </Text>
            );
          case "hr":
            return <View key={idx} style={[s.hr, { backgroundColor: borderColor }]} />;
          case "paragraph":
            return (
              <View key={idx} style={s.paragraph}>
                <InlineText
                  text={block.text}
                  color={textColor}
                  mutedColor={mutedColor}
                  size={13}
                  lineHeight={21}
                />
              </View>
            );
          case "bullet":
            return (
              <View key={idx} style={s.bulletList}>
                {block.items.map((item, ii) => (
                  <View key={ii} style={s.bulletItem}>
                    <View style={[s.bulletDot, { backgroundColor: primaryColor }]} />
                    <View style={{ flex: 1 }}>
                      <InlineText
                        text={item}
                        color={textColor}
                        mutedColor={mutedColor}
                        size={13}
                        lineHeight={20}
                      />
                    </View>
                  </View>
                ))}
              </View>
            );
          case "table":
            return (
              <View key={idx} style={[s.table, { borderColor }]}>
                <View style={[s.tableRow, s.tableHeader, { backgroundColor: mutedBg, borderBottomColor: borderColor }]}>
                  {block.headers.map((h, hi) => (
                    <Text key={hi} style={[s.th, { color: textColor, flex: hi === 0 ? 2 : 1 }]}>
                      {h}
                    </Text>
                  ))}
                </View>
                {block.rows.map((row, ri) => (
                  <View
                    key={ri}
                    style={[
                      s.tableRow,
                      ri < block.rows.length - 1 && { borderBottomWidth: 1, borderBottomColor: borderColor },
                    ]}
                  >
                    {row.map((cell, ci) => (
                      <Text key={ci} style={[s.td, { color: textColor, flex: ci === 0 ? 2 : 1 }]}>
                        {cell}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            );
          default:
            return null;
        }
      })}
    </View>
  );
}

const s = StyleSheet.create({
  h1: {
    fontFamily: "Inter_700Bold",
    fontSize: 17,
    marginTop: 18,
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
  },
  h2: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    marginTop: 16,
    marginBottom: 6,
  },
  h3: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    marginTop: 10,
    marginBottom: 4,
  },
  hr: {
    height: 1,
    marginVertical: 14,
  },
  paragraph: {
    marginBottom: 10,
  },
  bulletList: {
    marginBottom: 10,
    gap: 6,
  },
  bulletItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 7,
  },
  table: {
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 12,
    overflow: "hidden",
  },
  tableRow: {
    flexDirection: "row",
  },
  tableHeader: {
    borderBottomWidth: 1,
  },
  th: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    padding: 10,
  },
  td: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    padding: 10,
  },
});
