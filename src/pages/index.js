import { useState } from "react";
import JSZip from "jszip";

export default function Page() {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState("");
  const [placeholders, setPlaceholders] = useState([]);
  const [values, setValues] = useState({});

  // Extrae placeholders del texto con regex
  function extractPlaceholders(text) {
    const regex = /{{(.*?)}}/g;
    const matches = new Set();
    let match;
    while ((match = regex.exec(text)) !== null) {
      matches.add(match[1].trim());
    }
    return Array.from(matches);
  }

  // Lee todos los archivos relevantes para extraer placeholders
  async function processFile(file) {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    let allPlaceholders = new Set();

    // Función helper para extraer placeholders y unirlos
    async function extractFromFile(filename) {
      if (!zip.file(filename)) return;
      const content = await zip.file(filename).async("string");
      extractPlaceholders(content).forEach((ph) => allPlaceholders.add(ph));
    }

    // Extraer del documento principal
    await extractFromFile("word/document.xml");

    // Extraer de todos los headers (header1.xml, header2.xml, ...)
    Object.keys(zip.files).forEach(async (filename) => {
      if (filename.startsWith("word/header") && filename.endsWith(".xml")) {
        await extractFromFile(filename);
      }
    });

    // Extraer de todos los footers (footer1.xml, footer2.xml, ...)
    Object.keys(zip.files).forEach(async (filename) => {
      if (filename.startsWith("word/footer") && filename.endsWith(".xml")) {
        await extractFromFile(filename);
      }
    });

    // Esperar un poco para que terminen las llamadas asíncronas (simplificación)
    // Mejor usar un Promise.all para los headers/footers, aquí lo hacemos simple
    await new Promise((r) => setTimeout(r, 500));

    const phArray = Array.from(allPlaceholders);
    setPlaceholders(phArray);

    // Inicializa los valores vacíos o con el mismo nombre
    const initialValues = {};
    phArray.forEach((ph) => {
      initialValues[ph] = "";
    });
    setValues(initialValues);
  }

  function handleFileChange(e) {
    const uploadedFile = e.target.files[0];
    setFile(uploadedFile);
    setFileName(uploadedFile.name);
    setPlaceholders([]);
    setValues({});
    processFile(uploadedFile);
  }

  function handleInputChange(e) {
    const { name, value } = e.target;
    setValues((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  // Reemplaza placeholders en un texto con los valores
  function replacePlaceholders(text, replacements) {
    return text.replace(/{{(.*?)}}/g, (_, key) => {
      const k = key.trim();
      return replacements[k] !== undefined ? replacements[k] : `{{${k}}}`;
    });
  }

  async function handleDownload() {
    if (!file) {
      alert("Sube un archivo primero.");
      return;
    }

    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    // Reemplazo en document.xml
    if (zip.file("word/document.xml")) {
      const documentXml = await zip.file("word/document.xml").async("string");
      zip.file("word/document.xml", replacePlaceholders(documentXml, values));
    }

    // Reemplazo en headers y footers
    const replacePromises = Object.keys(zip.files)
      .filter(
        (filename) =>
          (filename.startsWith("word/header") || filename.startsWith("word/footer")) &&
          filename.endsWith(".xml")
      )
      .map(async (filename) => {
        const content = await zip.file(filename).async("string");
        const replaced = replacePlaceholders(content, values);
        zip.file(filename, replaced);
      });

    await Promise.all(replacePromises);

    const newZipContent = await zip.generateAsync({ type: "blob" });

    const a = document.createElement("a");
    a.href = URL.createObjectURL(newZipContent);
    a.download = `reemplazado_${fileName}`;
    a.click();
  }

  return (
    <main className="p-8 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Reemplazo automático en DOCX</h1>

      <input type="file" accept=".docx" onChange={handleFileChange} />
      {fileName && <p className="text-sm text-gray-600">Archivo cargado: {fileName}</p>}

      {placeholders.length > 0 && (
        <>
          <h2 className="font-semibold mt-6 mb-2">Campos detectados:</h2>
          <form>
            {placeholders.map((ph) => (
              <div key={ph} className="mb-2">
                <label htmlFor={ph} className="block font-medium text-sm mb-1">
                  {ph}
                </label>
                <input
                  type="text"
                  id={ph}
                  name={ph}
                  value={values[ph]}
                  onChange={handleInputChange}
                  className="border rounded px-2 py-1 w-full"
                />
              </div>
            ))}
          </form>
        </>
      )}

      <button
        onClick={handleDownload}
        className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        Descargar archivo modificado
      </button>

      <p className="mt-4 text-xs text-gray-500">
        Este sistema detecta automáticamente los campos entre llaves como <code>{`{{campo}}`}</code> y los reemplaza.
      </p>
    </main>
  );
}
