/**
 * Assembles the deck: each slide is a 1920x1080 PNG (text, rendered from deck/slides/*.html with our fonts),
 * an animated GIF of the app placed in the slide's clip rectangle, and a corner mask on top.
 *
 *   bun deck/build.ts <out.pptx> '<json: [{ png, gif, rect: [x, y, w, h], notes? }]>'
 */
import PptxGenJS from "pptxgenjs";

const [outFile, slidesJson] = process.argv.slice(2);
const slides = JSON.parse(slidesJson) as {
  png: string;
  gif?: string;
  rect?: [number, number, number, number];
  notes?: string;
}[];
const dir = new URL("./out/", import.meta.url).pathname;

const IN_PER_PX = 13.333 / 1920;
const pptx = new PptxGenJS();
pptx.layout = "LAYOUT_WIDE";

for (const s of slides) {
  const slide = pptx.addSlide();
  slide.background = { path: dir + s.png };
  if (s.gif && s.rect) {
    const [x, y, w, h] = s.rect.map((n) => n * IN_PER_PX);
    slide.addImage({ path: dir + s.gif, x, y, w, h });
    slide.addImage({ path: `${dir}mask.png`, x, y, w, h });
  }
  if (s.notes) slide.addNotes(s.notes);
}

await pptx.writeFile({ fileName: outFile });
console.log("written", outFile);
