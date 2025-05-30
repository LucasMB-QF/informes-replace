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

    let allText = "";
    const walk = (node) => {
      if (typeof node !== "object") return;
      for (const key in node) {
        if (Array.isArray(node[key])) {
          node[key].forEach((child) => {
            if (key === "w:t") {
              const value = typeof child === "string" ? child : child._;
              if (value) {
                allText += value;
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
    const matches = [...allText.matchAll(regex)];

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

    const replacePlaceholdersInTextNodes = (node) => {
      if (typeof node !== "object") return;

      for (const key in node) {
        if (Array.isArray(node[key])) {
          for (let i = 0; i < node[key].length; i++) {
            const run = node[key][i];
            if (run["w:t"]) {
              // Buscar secuencia de nodos con texto consecutivos
              const texts = [];
              const indexes = [];

              let j = i;
              while (j < node[key].length && node[key][j]["w:t"]) {
                const txt = node[key][j]["w:t"][0];
                texts.push(typeof txt === "string" ? txt : txt._ ?? "");
                indexes.push(j);

                const combined = texts.join("");
                const match = combined.match(/{{\s*([^{}]+?)\s*}}/);
                if (match) {
                  const fieldName = match[1].trim();
                  const replacement = fields[fieldName] ?? "";

                  // Reemplazar en primer nodo
                  node[key][indexes[0]]["w:t"][0]._ = replacement;

                  // Borrar los otros textos
                  for (let z = 1; z < indexes.length; z++) {
                    delete node[key][indexes[z]]["w:t"];
                  }

                  break; // salir después de reemplazar
                }

                j++;
              }
            } else {
              replacePlaceholdersInTextNodes(run);
            }
          }
        }
      }
    };

    replacePlaceholdersInTextNodes(body);

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
              <textarea
                rows={2}
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
