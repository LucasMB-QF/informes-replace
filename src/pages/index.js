const handleFileChange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  setZipFile(zip);
  setFileName(file.name);

  let fullText = "";
  const targetFiles = ["word/document.xml"];

  // Obtener los nombres de los encabezados
  const headerFiles = zip.folder("word").file(/header[0-9]*\.xml/);
  headerFiles.forEach((h) => targetFiles.push(h.name));

  for (const filePath of targetFiles) {
    const fileEntry = zip.file(filePath);
    if (!fileEntry) continue;

    const xml = await fileEntry.async("text");
    const parsed = await parseStringPromise(xml);

    const body = parsed["w:document"]?.["w:body"]?.[0] || parsed["w:hdr"];
    const textRuns = [];

    const extractText = (node) => {
      if (typeof node !== "object") return;
      for (const key in node) {
        if (Array.isArray(node[key])) {
          node[key].forEach((item) => {
            if (key === "w:t") {
              if (typeof item === "string") textRuns.push(item);
              else if (item._) textRuns.push(item._);
            } else {
              extractText(item);
            }
          });
        }
      }
    };

    extractText(body);
    fullText += textRuns.join("");
  }

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
