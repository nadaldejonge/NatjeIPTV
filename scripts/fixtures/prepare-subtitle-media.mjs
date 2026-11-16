import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
const directory = path.resolve("artifacts/android-tv/verification/media"); fs.mkdirSync(directory, { recursive: true });
const captions = ["English captions", "Nederlandse geforceerde tekst", "Nederlandse volledige ondertiteling"];
for (let index = 0; index < captions.length; index++) fs.writeFileSync(path.join(directory, `captions-${index}.srt`), `1\n00:00:00,100 --> 00:00:29,900\n${captions[index]}\n\n`);
const run = (args) => { const process = spawnSync("ffmpeg", ["-y", "-v", "error", ...args], { encoding: "utf8" }); if (process.status !== 0) throw Error(process.stderr || process.error?.message); };
run(["-f","lavfi","-i","testsrc=size=384x216:rate=10","-f","lavfi","-i","sine=frequency=440:sample_rate=48000","-f","lavfi","-i","sine=frequency=880:sample_rate=48000",
  ...captions.flatMap((_,index)=>["-i",path.join(directory,`captions-${index}.srt`)]),
  "-map","0:v","-map","1:a","-map","2:a","-map","3:s","-map","4:s","-map","5:s","-t","30",
  "-c:v","libx264","-preset","ultrafast","-pix_fmt","yuv420p","-c:a","aac","-c:s","srt",
  "-metadata:s:a:0","language=eng","-metadata:s:a:1","language=dut",
  "-metadata:s:s:0","language=eng","-metadata:s:s:0","title=English","-disposition:s:0","default",
  "-metadata:s:s:1","language=dut","-metadata:s:s:1","title=Dutch Forced","-disposition:s:1","forced",
  "-metadata:s:s:2","language=nld","-metadata:s:s:2","title=Dutch Full","-disposition:s:2","0",path.join(directory,"subtitles.mkv")]);
run(["-i",path.join(directory,"subtitles.mkv"),"-map","0:v:0","-map","0:a:0","-map","0:s:0","-c","copy",path.join(directory,"english-only.mkv")]);
console.log("Synthetic MKV fixtures: 2 audio languages, English/default, Dutch/forced, Dutch/full, and English-only.");
