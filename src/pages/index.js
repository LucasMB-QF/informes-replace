import { useState } from "react";
import { saveAs } from "file-saver";
import JSZip from "jszip";
import { parseStringPromise } from "xml2js";

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

    let textRuns = [];

    const extractText = (node) => {
      if (typeof node !== "object") return;
      for (const key in node) {
        if (Array.isArray(node[key])) {
          node[key].forEach((item) => {
            if (key === "w:t") {
              if (typeof item === "string") {
                textRuns.push(item);
              } else if (item._) {
                textRuns.push(item._);
              }
            } else {
              extractText(item);
            }
          });
        }
      }
    };

    extractText(body);

    const fullText = textRuns.join("");
    const regex = /{{\s*([^{}]+?)\s*}}/g;
    const matches = [...fullText.matchAll(regex)];

    let detectedFields = {};
    let ordered = [];

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

    const zipClone = await JSZip.loadAsync(await zipFile.generateAsync({ type: "arraybuffer" }));

    const replaceFieldsInXml = (xmlText) => {
      let result = xmlText;
      for (const [key, value] of Object.entries(fields)) {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, "g");
        result = result.replace(regex, value);
      }
      return result;
    };

    // Reemplazar en document.xml
    const documentXml = await zipFile.file("word/document.xml").async("text");
    const newDocumentXml = replaceFieldsInXml(documentXml);
    zipClone.file("word/document.xml", newDocumentXml);

    // Reemplazar en headers
    const headerFiles = Object.keys(zipFile.files).filter((f) =>
      /^word\/header\d+\.xml$/.test(f)
    );

    for (const headerPath of headerFiles) {
      const headerXml = await zipFile.file(headerPath).async("text");
      const newHeaderXml = replaceFieldsInXml(headerXml);
      zipClone.file(headerPath, newHeaderXml);
    }

    const modifiedDoc = await zipClone.generateAsync({ type: "blob" });
    saveAs(modifiedDoc, `modificado-${fileName}`);
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
