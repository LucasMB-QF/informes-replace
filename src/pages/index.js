import { useState } from "react";
import { saveAs } from "file-saver";
import JSZip from "jszip";
import { parseStringPromise, Builder } from "xml2js";

export default function Home() {
  const [fields, setFields] = useState({});
  const [fieldOrder, setFieldOrder] = useState([]);
  const [fileName, setFileName] = useState("");
  const [zipFile, setZipFile] = useState(null);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    setZipFile(zip);
    setFileName(file.name);

    const xml = await zip.file("word/document.xml").async("text");
    extractFieldsFromXml(xml);
  };

  const extractFieldsFromXml = async (xml) => {
    const parsed = await parseStringPromise(xml);
    const body = parsed["w:document"]["w:body"][0];

    let fullText = "";
    const placeholders = [];
    const textNodes = [];

    const walk = (node) => {
      if (typeof node !== "object") return;

      for (const key in node) {
        if (Array.isArray(node[key])) {
          node[key].forEach((child) => {
            if (key === "w:t") {
              const value = typeof child === "string" ? child : child._;
              if (value) {
                textNodes.push({ node: child, value });
                fullText += value;
              }
            } else {
              walk(child);
            }
          });
        }
      }
    };

    walk(body);

    const regex = /{{\s*([^{}]+?)\s*}}/g;
    const matches = [...fullText.matchAll(regex)];

    const detectedFields = {};
    const ordered = [];

    matches.forEach((match) => {
      const key = match[1].trim();
      if (key && !(key in detectedFields)) {
        detectedFields[key] = "";
        ordered.push(key);
      }
    });

    setFields(detectedFields);
    setFieldOrder(ordered);
  };

  const handleFieldChange = (key, value) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  const handleDownload = async () => {
    if (!zipFile) return;

    const xml = await zipFile.file("word/document.xml").async("text");
    const parsed = await parseStringPromise(xml);
    const body = parsed["w:document"]["w:body"][0];

    let buffer = "";
    const bufferNodes = [];

    const process = (node) => {
      if (typeof node !== "object") return;

      for (const key in node) {
        if (Array.isArray(node[key])) {
          node[key].forEach((child) => {
            if (key === "w:t") {
              const text = typeof child === "string" ? child : child._;
              if (text) {
                buffer += text;
                bufferNodes.push({ parent: child, text });
              }
            } else {
              process(child);
            }
          });
        }
      }
    };

    process(body);

    let replaced = buffer;
    for (const [key, value] of Object.entries(fields)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, "g");
      replaced = replaced.replace(regex, value);
    }

    // Redistribute replaced text into original nodes
    let offset = 0;
    bufferNodes.forEach(({ parent, text }) => {
      const newText = replaced.slice(offset, offset + text.length);
      if (typeof parent === "string") {
        parent = newText;
      } else {
        parent._ = newText;
      }
      offset += text.length;
    });

    const builder = new Builder();
    const newXml = builder.buildObject(parsed);

    const zipClone = await JSZip.loadAsync(await zipFile.generateAsync({ type: "arraybuffer" }));
    zipClone.file("word/document.xml", newXml);
    const blob = await zipClone.generateAsync({ type: "blob" });

    saveAs(blob, `modificado-${fileName}`);
  };

  return (
    <main className="p-4 max-w-xl mx-auto">
      <h1 className="text-xl font-bold mb-4">Reemplazo de campos en .docx</h1>
      <input type="file" accept=".docx" onChange={handleFileChange} />

      {fieldOrder.length > 0 && (
        <div className="mt-4 space-y-2">
          {fieldOrder.map((key) => (
            <div key={key}>
              <label className="block text-sm font-semibold">{key}</label>
              <input
                type="text"
                value={fields[key]}
                onChange={(e) => handleFieldChange(key, e.target.value)}
                className="w-full border p-2 rounded"
              />
            </div>
          ))}
          <button
            onClick={handleDownload}
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded"
          >
            Descargar documento reemplazado
          </button>
        </div>
      )}

      {fieldOrder.length === 0 && fileName && (
        <p className="mt-4 text-sm text-gray-500">
          No se detectaron campos <code>{"{{campo}}"}</code> en el documento.
        </p>
      )}
    </main>
  );
}
