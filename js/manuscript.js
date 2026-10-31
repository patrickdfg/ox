// 원고 파일(HWP, HWPX, PPTX, DOCX, PDF, TXT)에서 글자만 뽑아 낸다. 모두 브라우저 안에서 처리한다.
const LIBS = {
  jszip: "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
  pdf: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
  pdfWorker: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",
  cfb: "https://cdn.jsdelivr.net/npm/cfb@1.2.2/dist/cfb.min.js"
};
const loading = {};
function loadScript(key) {
  return loading[key] ||= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = LIBS[key];
    script.onload = resolve;
    script.onerror = () => { delete loading[key]; reject(new Error("파일 읽기 도구를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.")); };
    document.head.append(script);
  });
}

const decodeEntities = text => {
  const box = document.createElement("textarea");
  box.innerHTML = text;
  return box.value;
};
const clean = text => text.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

// <p> 단위로 끊고 그 안의 <t> 글자를 모은다. (pptx: a:p/a:t, docx: w:p/w:t, hwpx: hp:p/hp:t)
function xmlParagraphs(xml, p, t) {
  const para = new RegExp(`<${p}[ >][\\s\\S]*?</${p}>`, "g");
  const run = new RegExp(`<${t}(?:\\s[^>]*)?>([\\s\\S]*?)</${t}>`, "g");
  const lines = [];
  for (const block of xml.match(para) || []) {
    let line = "";
    for (const m of block.matchAll(run)) line += decodeEntities(m[1].replace(/<[^>]+>/g, ""));
    lines.push(line);
  }
  return lines.join("\n");
}

const byNumber = (a, b) => Number(a.match(/(\d+)\.xml$/)[1]) - Number(b.match(/(\d+)\.xml$/)[1]);

async function openZip(file) {
  await loadScript("jszip");
  try { return await window.JSZip.loadAsync(await file.arrayBuffer()); }
  catch { throw new Error("파일이 손상되었거나 지원하지 않는 형식이에요."); }
}

async function readPptx(file) {
  const zip = await openZip(file);
  const slides = Object.keys(zip.files).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort(byNumber);
  if (!slides.length) throw new Error("PPT 슬라이드를 찾지 못했어요.");
  const parts = [];
  for (const name of slides) parts.push(xmlParagraphs(await zip.file(name).async("string"), "a:p", "a:t"));
  return parts.join("\n\n");
}

async function readDocx(file) {
  const zip = await openZip(file);
  const doc = zip.file("word/document.xml");
  if (!doc) throw new Error("워드 본문을 찾지 못했어요.");
  return xmlParagraphs(await doc.async("string"), "w:p", "w:t");
}

async function readHwpx(file) {
  const zip = await openZip(file);
  const sections = Object.keys(zip.files).filter(n => /^Contents\/section\d+\.xml$/i.test(n)).sort(byNumber);
  if (!sections.length) throw new Error("한글 본문을 찾지 못했어요.");
  const parts = [];
  for (const name of sections) parts.push(xmlParagraphs(await zip.file(name).async("string"), "hp:p", "hp:t"));
  return parts.join("\n");
}

async function inflateRaw(bytes) {
  if (!("DecompressionStream" in window)) throw new Error("이 브라우저는 HWP 파일을 읽을 수 없어요. 최신 Chrome·Edge를 쓰거나 HWPX·PDF로 저장해 올려 주세요.");
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw")).getReader();
  const chunks = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.length;
    }
  } catch (error) {
    // HWP 구간 끝에는 압축이 끝난 뒤 여분의 바이트가 붙어 있을 수 있다. 이미 읽은 부분은 그대로 쓴다.
    if (!total) throw new Error("HWP 본문을 풀지 못했어요. HWPX나 PDF로 저장해 올려 주세요.");
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) { out.set(chunk, at); at += chunk.length; }
  return out;
}

// HWP 5.x 구간 하나에서 문단 글자(PARA_TEXT 레코드)를 꺼낸다.
function hwpSectionText(data) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const lines = [];
  let pos = 0;
  while (pos + 4 <= data.length) {
    const head = view.getUint32(pos, true);
    pos += 4;
    const tag = head & 0x3ff;
    let size = head >>> 20;
    if (size === 0xfff) { size = view.getUint32(pos, true); pos += 4; }
    if (tag === 67) { // HWPTAG_PARA_TEXT
      let line = "";
      for (let i = pos; i + 1 < pos + size;) {
        const c = view.getUint16(i, true);
        if (c >= 32) { line += String.fromCharCode(c); i += 2; }
        else if (c === 10 || c === 13) { i += 2; }
        else if (c === 0 || (c >= 24 && c <= 31)) { i += 2; }
        else if (c === 9) { line += " "; i += 16; }
        else i += 16; // 표·그림 같은 확장 컨트롤은 8글자 분량
      }
      lines.push(line);
    }
    pos += size;
  }
  return lines.join("\n");
}

async function readHwp(file) {
  await loadScript("cfb");
  let container;
  try { container = window.CFB.read(new Uint8Array(await file.arrayBuffer()), { type: "array" }); }
  catch { throw new Error("HWP 파일을 열지 못했어요. HWPX나 PDF로 저장해 올려 주세요."); }
  const header = window.CFB.find(container, "/FileHeader");
  if (!header) throw new Error("한글 5.x 형식의 HWP가 아니에요.");
  const flags = new DataView(new Uint8Array(header.content).buffer).getUint32(36, true);
  if (flags & 2) throw new Error("암호가 걸린 HWP는 읽을 수 없어요. 암호를 푼 파일을 올려 주세요.");
  const compressed = Boolean(flags & 1);
  const sections = container.FullPaths
    .map((path, i) => ({ path, entry: container.FileIndex[i] }))
    .filter(x => /\/BodyText\/Section\d+$/.test(x.path))
    .sort((a, b) => Number(a.path.match(/(\d+)$/)[1]) - Number(b.path.match(/(\d+)$/)[1]));
  if (!sections.length) throw new Error("배포용 문서이거나 본문을 찾지 못했어요. 한글에서 일반 문서로 저장한 뒤 다시 올려 주세요.");
  const parts = [];
  for (const { entry } of sections) {
    let bytes = new Uint8Array(entry.content);
    if (compressed) bytes = await inflateRaw(bytes);
    parts.push(hwpSectionText(bytes));
  }
  return parts.join("\n");
}

async function readPdf(file) {
  await loadScript("pdf");
  const pdfjs = window.pdfjsLib;
  pdfjs.GlobalWorkerOptions.workerSrc = LIBS.pdfWorker;
  let pdf;
  try { pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise; }
  catch (error) {
    if (error?.name === "PasswordException") throw new Error("암호가 걸린 PDF는 읽을 수 없어요.");
    throw new Error("PDF를 열지 못했어요.");
  }
  const pages = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const content = await (await pdf.getPage(n)).getTextContent();
    let text = "";
    for (const item of content.items) text += item.str + (item.hasEOL ? "\n" : "");
    pages.push(text);
  }
  return pages.join("\n\n");
}

export const MANUSCRIPT_ACCEPT = ".hwp,.hwpx,.ppt,.pptx,.pdf,.docx,.txt,.md";
const MAX_FILE_BYTES = 30 * 1024 * 1024;

export async function readManuscript(file) {
  if (file.size > MAX_FILE_BYTES) throw new Error("파일이 너무 커요. 30MB 이하로 올려 주세요.");
  const ext = (file.name.match(/\.([^.]+)$/)?.[1] || "").toLowerCase();
  let text;
  if (ext === "pptx") text = await readPptx(file);
  else if (ext === "ppt") throw new Error("옛 형식(.ppt)은 읽을 수 없어요. PowerPoint에서 .pptx로 저장하거나 PDF로 내보내 올려 주세요.");
  else if (ext === "hwpx") text = await readHwpx(file);
  else if (ext === "hwp") text = await readHwp(file);
  else if (ext === "pdf") text = await readPdf(file);
  else if (ext === "docx") text = await readDocx(file);
  else if (ext === "txt" || ext === "md") text = await file.text();
  else throw new Error("한글(.hwp/.hwpx), PPT(.pptx), PDF, 워드(.docx), 텍스트(.txt) 파일을 올려 주세요.");
  text = clean(text);
  if (!text) throw new Error(ext === "pdf" ? "글자를 찾지 못했어요. 스캔한 이미지 PDF는 읽을 수 없어요." : "파일에서 글자를 찾지 못했어요.");
  return text;
}
