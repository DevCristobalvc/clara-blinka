// Narrates docs/pitch.md with ElevenLabs and muxes the voice onto the demo video.
// usage: node --env-file=.env.local scripts/narrate.mjs [video=docs/demo/orbit-demo.mp4] [out=docs/demo/orbit-demo-voz.mp4]
// needs: ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID; ffmpeg/ffprobe on PATH.
// Each "## N. Title [m:ss–m:ss]" block in the script becomes one clip placed at its start time; if a clip runs
// long, the next one starts when it ends. The video is padded with its last frame if the voice outlives it.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const [video = "docs/demo/orbit-demo.mp4", out = "docs/demo/orbit-demo-voz.mp4"] = process.argv.slice(2);
const key = process.env.ELEVENLABS_API_KEY ?? process.env.ELEVEN_LABS_API_KEY ?? process.env.ELEVENLABS_KEY ?? process.env.XI_API_KEY;
if (!key) {
  console.error("Set ELEVENLABS_API_KEY in .env.local");
  process.exit(1);
}
// Voice by id, or by name in the account (default "William").
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

// Parse the narration blocks: "## 0. Gancho [0:00–0:15] · pantalla: ..." followed by paragraphs until the next "##".
const md = readFileSync("docs/pitch.md", "utf8").split("\n## Pitch de 60 segundos")[0];
const blocks = [];
for (const section of md.split(/\n## /).slice(1)) {
  const [head, ...rest] = section.split("\n");
  const m = /^(\d+)\. .*?\[(\d+):(\d+)[–-]/.exec(head);
  if (!m) continue;
  const text = rest.join("\n").replace(/^---.*$/gm, "").trim();
  if (text) blocks.push({ n: Number(m[1]), start: Number(m[2]) * 60 + Number(m[3]), text });
}
console.log(`${blocks.length} blocks`);

const dur = (f) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString().trim());

// 1. Text to speech, one clip per block (cached by block number + text hash).
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

// 2. Place each clip where its block starts on screen (docs/demo/timeline.json from the recorder, else the
//    script's planned times), or right after the previous clip if that ran long.
const timelineFile = `${dir.replace(/\/voice$/, "")}/timeline.json`;
const timeline = existsSync(timelineFile) ? Object.fromEntries(JSON.parse(readFileSync(timelineFile, "utf8")).map((t) => [t.block, t.at])) : {};
let cursor = 0;
for (const c of clips) {
  c.at = Math.max(timeline[c.n] ?? c.start, cursor);
  cursor = c.at + c.length + 0.4;
}
const voiceEnd = cursor;
const videoLen = dur(video);
console.table(clips.map((c) => ({ block: c.n, planned: c.start, placed: c.at.toFixed(1), length: c.length.toFixed(1) })));
console.log(`voice ends at ${voiceEnd.toFixed(1)} s, video is ${videoLen.toFixed(1)} s`);

// 2b. Tighten the quiet stretch while the board fills (block 5): play it 3x faster from 14 s after the block
//     starts until 1 s before block 6, and shift every later clip accordingly.
const FAST = 3;
const b5 = timeline[5], b6 = timeline[6];
let fast = null;
if (b5 !== undefined && b6 !== undefined && b6 - b5 > 30) {
  fast = { from: b5 + 14, to: b6 - 1 };
  const saved = (fast.to - fast.from) * (1 - 1 / FAST);
  for (const c of clips) if (c.at >= fast.to) c.at -= saved;
  // keep clips sequential after the shift
  let cur = 0;
  for (const c of clips) { c.at = Math.max(c.at, cur); cur = c.at + c.length + 0.4; }
  console.log(`fast segment ${fast.from.toFixed(1)}–${fast.to.toFixed(1)} s at ${FAST}x, saves ${saved.toFixed(1)} s`);
}

// 3. Mix: delay each clip, sum them, then mux onto the video (pad the video with its last frame if needed).
const inputs = clips.flatMap((c) => ["-i", c.file]);
const delays = clips.map((c, i) => `[${i + 1}:a]adelay=${Math.round(c.at * 1000)}|${Math.round(c.at * 1000)}[a${i}]`).join(";");
const mix = `${delays};${clips.map((_, i) => `[a${i}]`).join("")}amix=inputs=${clips.length}:normalize=0,volume=1.0,apad[voice]`;
const videoOut = fast ? videoLen - (fast.to - fast.from) * (1 - 1 / FAST) : videoLen;
const voiceTail = Math.max(...clips.map((c) => c.at + c.length));
const pad = voiceTail > videoOut ? `,tpad=stop_mode=clone:stop_duration=${(voiceTail - videoOut + 0.5).toFixed(2)}` : "";
const vchain = fast
  ? `[0:v]trim=0:${fast.from},setpts=PTS-STARTPTS[v0];[0:v]trim=${fast.from}:${fast.to},setpts=(PTS-STARTPTS)/${FAST}[v1];[0:v]trim=${fast.to},setpts=PTS-STARTPTS[v2];[v0][v1][v2]concat=n=3:v=1:a=0${pad}[v]`
  : `[0:v]setpts=PTS-STARTPTS${pad}[v]`;
execFileSync(
  "ffmpeg",
  ["-v", "error", "-y", "-i", video, ...inputs, "-filter_complex", `${vchain};${mix}`, "-map", "[v]", "-map", "[voice]", "-c:v", "libx264", "-preset", "fast", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", out],
  { stdio: "inherit" },
);
console.log("written", out, `${dur(out).toFixed(1)} s`);
