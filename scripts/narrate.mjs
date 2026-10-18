// Narrates docs/pitch.md with ElevenLabs and edits the demo video: voice placed on the recorder's timeline,
// the quiet board-filling stretch time-lapsed, smooth zoom-ins on the moments the recorder marked, a Spanish
// lower-third caption per block (the "> …" line in the script), and a fade in/out.
// usage: node --env-file=.env.local scripts/narrate.mjs [video=docs/demo/orbit-demo.mp4] [out=docs/demo/orbit-demo-voz.mp4] [--voice-only]
//   --voice-only: only (re)generate the voice clips in docs/demo/voice (the recorder sizes its segments from them).
// needs: ELEVENLABS_API_KEY (voice by ELEVENLABS_VOICE_ID or by name, default "William"); ffmpeg/ffprobe on PATH.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

const flags = process.argv.slice(2).filter((a) => a.startsWith("--"));
const [video = "docs/demo/orbit-demo.mp4", out = "docs/demo/orbit-demo-voz.mp4"] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const voiceOnly = flags.includes("--voice-only");
const key = process.env.ELEVENLABS_API_KEY ?? process.env.ELEVEN_LABS_API_KEY ?? process.env.ELEVENLABS_KEY ?? process.env.XI_API_KEY;
if (!key) {
  console.error("Set ELEVENLABS_API_KEY in .env.local");
  process.exit(1);
}
let voice = process.env.ELEVENLABS_VOICE_ID;
if (!voice) {
  const wanted = (process.env.ELEVENLABS_VOICE_NAME ?? "William").toLowerCase();
  const res = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": key } });
  if (!res.ok) throw new Error(`ElevenLabs voices ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const { voices } = await res.json();
  const found = voices.find((v) => v.name.toLowerCase() === wanted) ?? voices.find((v) => v.name.toLowerCase().includes(wanted));
  if (!found) {
    console.error(`No voice named "${wanted}". Available: ${voices.map((v) => v.name).join(", ")}`);
    process.exit(1);
  }
  voice = found.voice_id;
  console.log(`voice: ${found.name} (${found.category ?? "?"})`);
}
const model = process.env.ELEVENLABS_MODEL ?? "eleven_multilingual_v2";
const dir = "docs/demo/voice";
mkdirSync(dir, { recursive: true });

// Parse the script: "## N. Title [m:ss–m:ss] · pantalla: …", then an optional "> caption" line, then the narration.
const md = readFileSync("docs/pitch.md", "utf8").split("\n## Pitch de 60 segundos")[0];
const blocks = [];
for (const section of md.split(/\n## /).slice(1)) {
  const [head, ...rest] = section.split("\n");
  const m = /^(\d+)\. .*?\[(\d+):(\d+)[–-]/.exec(head);
  if (!m) continue;
  const caption = rest.find((l) => l.startsWith("> "))?.slice(2).trim();
  const text = rest.filter((l) => !l.startsWith("> ")).join("\n").replace(/^---.*$/gm, "").trim();
  if (text) blocks.push({ n: Number(m[1]), start: Number(m[2]) * 60 + Number(m[3]), text, caption });
}
console.log(`${blocks.length} blocks`);

const dur = (f) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString().trim());

// 1. Text to speech, one clip per block (cached by block number; delete docs/demo/voice to re-record).
const clips = [];
for (const b of blocks) {
  const file = `${dir}/block-${b.n}.mp3`;
  if (!existsSync(file)) {
    process.stdout.write(`block ${b.n}: ${b.text.length} chars → ElevenLabs… `);
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ text: b.text, model_id: model, voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true } }),
    });
    if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`);
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    console.log("ok");
  }
  clips.push({ ...b, file, length: dur(file) });
}
console.table(clips.map((c) => ({ block: c.n, seconds: c.length.toFixed(1), caption: c.caption ?? "" })));
if (voiceOnly) {
  console.log(`voice total ${clips.reduce((s, c) => s + c.length, 0).toFixed(1)} s`);
  process.exit(0);
}

// 2. Timeline from the recorder: where each block starts, and the zoom-ins it marked.
const timelineFile = `${dir.replace(/\/voice$/, "")}/timeline.json`;
const raw = existsSync(timelineFile) ? JSON.parse(readFileSync(timelineFile, "utf8")) : [];
const marks = Array.isArray(raw) ? raw : raw.blocks ?? [];
const zooms = Array.isArray(raw) ? [] : raw.zooms ?? [];
const timeline = Object.fromEntries(marks.map((t) => [t.block, t.at]));
let cursor = 0;
for (const c of clips) {
  c.at = Math.max(timeline[c.n] ?? c.start, cursor);
  cursor = c.at + c.length + 0.4;
}
const videoLen = dur(video);

// 2b. Time-lapse the quiet stretch while the board fills (block 5): from 12 s after the block starts until
//     1.5 s before block 6, sped up so that stretch lasts about 12 s on screen. Later times shift accordingly.
const b5 = timeline[5], b6 = timeline[6];
let fast = null, FAST = 1, saved = 0;
if (b5 !== undefined && b6 !== undefined && b6 - b5 > 26) {
  fast = { from: b5 + 12, to: b6 - 1.5 };
  // The stretch lasts what block 5's narration still needs after the parts kept at normal speed (min 8 s).
  const clip5 = clips.find((c) => c.n === 5);
  const want = Math.max(8, (clip5?.length ?? 24) + 1.5 - 12 - (b6 - fast.to));
  FAST = Math.min(12, Math.max(2, Math.round((fast.to - fast.from) / want)));
  saved = (fast.to - fast.from) * (1 - 1 / FAST);
  console.log(`time-lapse ${fast.from.toFixed(1)}–${fast.to.toFixed(1)} s at ${FAST}x, saves ${saved.toFixed(1)} s`);
}
const remap = (t) => (!fast || t <= fast.from ? t : t < fast.to ? fast.from + (t - fast.from) / FAST : t - saved);
for (const c of clips) c.at = remap(c.at);
let cur = 0;
for (const c of clips) { c.at = Math.max(c.at, cur); cur = c.at + c.length + 0.4; }
console.table(clips.map((c) => ({ block: c.n, planned: c.start, placed: c.at.toFixed(1), length: c.length.toFixed(1) })));

const videoOut = videoLen - saved;
const voiceTail = Math.max(...clips.map((c) => c.at + c.length));
const total = Math.min(Math.max(videoOut, voiceTail + 0.5), voiceTail + 1.6); // never more than 1.6 s of screen after the voice ends
const pad = voiceTail > videoOut ? `,tpad=stop_mode=clone:stop_duration=${(voiceTail - videoOut + 0.5).toFixed(2)}` : "";
console.log(`voice ends at ${voiceTail.toFixed(1)} s, video ${videoLen.toFixed(1)} s → ${total.toFixed(1)} s`);

// 3. Video chain: time-lapse → zoom-ins (zoompan, eased) → captions → fades.
const FPS = 25;
const base = fast
  ? `[0:v]trim=0:${fast.from},setpts=PTS-STARTPTS[v0];[0:v]trim=${fast.from}:${fast.to},setpts=(PTS-STARTPTS)/${FAST}[v1];[0:v]trim=${fast.to},setpts=PTS-STARTPTS[v2];[v0][v1][v2]concat=n=3:v=1:a=0${pad},fps=${FPS}[vb]`
  : `[0:v]setpts=PTS-STARTPTS${pad},fps=${FPS}[vb]`;
const T = `(in/${FPS})`;
const zs = zooms.map((z) => ({ ...z, from: remap(z.from), to: remap(z.to) })).filter((z) => z.to - z.from > 1);
const ease = (z) => `clip((${T}-${z.from.toFixed(2)})/0.6,0,1)*clip((${z.to.toFixed(2)}-${T})/0.6,0,1)`;
const zExpr = zs.length ? `1+${zs.map((z) => `(${(z.z - 1).toFixed(2)})*${ease(z)}`).join("+")}` : "1";
const pick = (k) => (zs.length ? zs.map((z) => `between(${T},${z.from.toFixed(2)},${z.to.toFixed(2)})*clip(${z[k].toFixed(0)}-i${k === "cx" ? "w" : "h"}/zoom/2,0,i${k === "cx" ? "w" : "h"}-i${k === "cx" ? "w" : "h"}/zoom)`).join("+") : "0");
const zoomChain = `[vb]zoompan=z='${zExpr}':x='${pick("cx")}':y='${pick("cy")}':d=1:s=1920x1080:fps=${FPS}[vz]`;
const tmp = `${tmpdir()}/orbit-narrate`;
mkdirSync(tmp, { recursive: true });
// Captions: one transparent 1920×1080 PNG per block rendered with Chrome (this ffmpeg has no drawtext), faded in/out
// and overlaid while the block's narration plays.
const { chromium } = await import("playwright-core");
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const capPage = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const captioned = clips.filter((c) => c.caption);
for (const c of captioned) {
  c.png = `${tmp}/cap-${c.n}.png`;
  const text = c.caption.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  await capPage.setContent(`<html><body style="margin:0;width:1920px;height:1080px;background:transparent;font-family:Inter,-apple-system,'Helvetica Neue',Arial,sans-serif">
    <div style="position:absolute;left:72px;bottom:96px;display:flex;align-items:stretch;gap:0;max-width:1500px">
      <div style="width:10px;background:#f5e400;border-radius:3px"></div>
      <div style="background:rgba(0,0,0,.66);backdrop-filter:blur(2px);color:#fff;font-size:38px;font-weight:600;line-height:1.25;padding:18px 28px;border-radius:0 12px 12px 0;letter-spacing:-0.01em">${text}</div>
    </div></body></html>`);
  await capPage.screenshot({ path: c.png, omitBackground: true });
}
await browser.close();
const capInputs = captioned.flatMap((c) => ["-loop", "1", "-i", c.png]);
let overlays = "", last = "vz";
captioned.forEach((c, i) => {
  const a = c.at.toFixed(2), b = (c.at + c.length).toFixed(2), idx = clips.length + 1 + i;
  overlays += `[${idx}:v]format=rgba,fade=t=in:st=${a}:d=0.35:alpha=1,fade=t=out:st=${(c.at + c.length - 0.35).toFixed(2)}:d=0.35:alpha=1[c${i}];[${last}][c${i}]overlay=0:0:enable='between(t,${a},${b})'[o${i}];`;
  last = `o${i}`;
});
const fades = `fade=t=in:st=0:d=0.8,fade=t=out:st=${(total - 1).toFixed(2)}:d=1`;
const vchain = `${base};${zoomChain};${overlays}[${last}]${fades},trim=0:${total.toFixed(2)}[v]`;

// 4. Audio: each clip delayed to its place, summed, padded; mux and encode.
const inputs = [...clips.flatMap((c) => ["-i", c.file]), ...capInputs];
const delays = clips.map((c, i) => `[${i + 1}:a]adelay=${Math.round(c.at * 1000)}|${Math.round(c.at * 1000)}[a${i}]`).join(";");
const mix = `${delays};${clips.map((_, i) => `[a${i}]`).join("")}amix=inputs=${clips.length}:normalize=0,volume=1.0,apad[voice]`;
execFileSync(
  "ffmpeg",
  ["-v", "error", "-y", "-i", video, ...inputs, "-filter_complex", `${vchain};${mix}`, "-map", "[v]", "-map", "[voice]", "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-t", total.toFixed(2), "-movflags", "+faststart", out],
  { stdio: "inherit" },
);
console.log("written", out, `${dur(out).toFixed(1)} s`);
