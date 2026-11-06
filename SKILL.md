---
name: animated-shorts
description: Make a 45-70 s vertical animated story short in the viral "2D cartoon characters in a colourful 3D world" style, built entirely with code (HyperFrames + three.js), with no AI video generator and no credits. Works for complete beginners in the Claude Code desktop app. Use when the user says "make an animated short", "use the animated shorts skill", pastes a link to a short they want to copy the style of, or gives a story idea for a cartoon short.
---

# Animated Shorts (code-built, beginner friendly)

You make the whole short: story, script, voice timing, characters, 3D world, camera, sound, render.
The user only answers a few questions and says yes. Explain each step in one plain sentence as you go,
because the user may have never used a terminal. Never show long code to the user unless they ask.

Credit: the look targets and the script formula build on mromidev/claude-animated-shorts (MIT).

## Step 0: Setup check (do this first, every time)
Run these checks silently and install only what is missing. Say "I'm installing the free tools this needs, it takes a few minutes" once.

| Tool | Check | Install on Mac | Install on Windows |
|---|---|---|---|
| Node.js 22+ | `node -v` | `brew install node` | `winget install OpenJS.NodeJS` |
| FFmpeg | `ffmpeg -version` | `brew install ffmpeg` | `winget install Gyan.FFmpeg` |
| yt-dlp | `yt-dlp --version` | `brew install yt-dlp` | `winget install yt-dlp.yt-dlp` |
| Whisper (word timings) | `whisper-cli -h` | `brew install whisper-cpp` + download `ggml-base.en.bin` | `pip install openai-whisper` |
| HyperFrames | `npx hyperframes doctor --json` | comes with Node, run `npx hyperframes browser ensure` | same |

No Homebrew on a Mac: install it from brew.sh first (one command, it asks for the Mac password, the user types it themselves).
Make a project folder `~/animated-shorts/<short-name>/` and keep everything there.

## Step 1: Two questions, nothing more
Ask in one message:
1. "Paste a link to a short whose style you love (YouTube, TikTok or Instagram). Or type skip and I'll use the built-in style."
2. "What should the story be about? Give me a topic, or say surprise me."

Optional third question only if unclear: "Do you want to record the voice yourself, or should I generate one?"

## Step 2: Study the reference (only if they gave a link)
Do not ask Claude's opinion of the video. Measure it. You can't recreate an opinion, you can recreate a number.
1. Download it and its channel's latest 10-20 shorts in this style: `yt-dlp -f "bv*[height<=1280]+ba/b" -o "ref/%(id)s.%(ext)s" <url>`.
2. Contact sheets at full frame rate, one sheet per 2 s, so every micro-move is visible:
   `ffmpeg -i ref/X.mp4 -vf "scale=180:-1,tile=10x6" -vsync 0 ref/X_sheet_%03d.jpg` (60 frames per sheet at 30 fps).
3. Hard cuts: `ffmpeg -i ref/X.mp4 -vf "select='gt(scene,0.35)',showinfo" -f null - 2>&1 | grep pts_time`.
4. Colour and brightness per second: `ffmpeg -i ref/X.mp4 -vf "fps=1,signalstats,metadata=print" -f null -`.
5. Transcribe the audio (original language track) with whisper and count words per second.
6. Write `STYLE.md` with numbers only: words/s, cuts per video, how long camera moves last (frames), saturation, darkest and brightest values, character proportions in head-heights, outline thickness in px at 1080 wide.
7. Never copy their story, characters or shots. Never put their clips in the final short. The style is studied, the content is ours.

No link: use `references/style-2d-in-3d.md` as STYLE.md.

## Step 3: Story and script
1. **Pick a true story** with a physical cause and effect that is easy to show (a con, an invention, a disaster, a law, a weird job).
2. **Has it been done?** `yt-dlp --flat-playlist -J "ytsearch20:<topic> short"`. If the reference channel or anyone has it above 1M views, pick another, or find a fresh angle. Tell the user what you found.
3. **Check every fact** (date, place, numbers, names) with a web search before writing. Put facts + sources at the top of `SCRIPT.md`. Jokes must be true facts too.
4. **Write 45-70 s at ~3.7 words per second** with this formula:
   - Hook: the paradox as a fact, first sentence, 10-16 words, no intro.
   - Setting: when, where, one concrete detail.
   - Escalation: 3-5 beats, each bigger. Short in-character lines.
   - Mystery beat: one question ("But why would...?").
   - Pivot: "You see," then the real reason, with an everyday comparison.
   - Payoff: one or two short sentences, the twist lands, video ends on the last word.
   - Never describe what the viewer already sees.
5. **Virality check** before showing the script. Score the hook 1-10 on: paradox in sentence 1, concrete nouns, stakes, can be drawn in one frame, under 16 words, curiosity gap. Rewrite until every score is 7+. Show the user the hook score table and the script, and wait for "go".

## Step 4: Voice and timing
- User records: they send a voice file. Generated: use the voice tool they have (ElevenLabs, or macOS `say` as a free fallback for a test).
- Generated voices usually read at ~2.9 words/s. Speed them to ~3.4-3.7 with `ffmpeg -af atempo=1.18` and trim silence at both ends. Generate one take, not four.
- One steady narrator, fast, almost no pauses. Loudness about -14 LUFS.
- Word timings: `whisper-cli -m ggml-base.en.bin -f voice.wav -ojf` (word-level JSON). Fix obvious misreads by hand. Every visual change is timed to a word, landing 0-3 frames before it.

## Step 5: Build it (HyperFrames + three.js)
Read the `hyperframes` and `three` skills if they are installed. The video is a web page that moves: HTML, CSS and a three.js canvas, rendered to MP4 frame by frame. It is deterministic and free.

**Start from the template, never from zero.** `templates/eiffel-tower/` is a complete, proven short (world, characters, ink, lens blur, light presets, camera, staging). Copy it, then replace the story parts. Its README says what to change and in which order.

1. `npx hyperframes init <name> --example blank --resolution portrait --audio voice.wav --non-interactive` → 1080x1920, 30 fps, duration = voice length. Put three.js in `assets/` (`npm pack three@0.181.2`, copy `three.module.js` + `three.core.js`), no CDN at render time.
2. **World:** real 3D geometry in three.js. Free CC0 models (Kenney.nl, Poly Pizza) or simple shapes. Textures painted in code (Canvas2D): visible wood grain, dark seams between stones and planks.
3. **Characters:** flat 2D cards drawn in code (Canvas2D), standing in the 3D world, always facing the camera. Bean-shaped heads, stick limbs, dark plum outline, 6-14 facial expressions, blinks every 0.5-2.3 s. They receive the scene light and cast a real shadow.
4. **Ink lines:** a post effect that finds edges and depth jumps in the 3D world and draws near-black lines (about 3-5 px at 1080 wide). Characters are excluded, they carry their own outline.
5. **Camera:** almost never cuts. It glides to the next moment over 18-40 frames (slow in, slow out) and slowly pushes in during holds. Small shake on impacts that decays in 7 frames.
6. **Light follows the story:** warm and bright for the setup, deep night blue for the "You see" explanation.
7. **Lens blur** on close-ups so the eye goes to the character. Wide shots stay sharp.
8. **On-screen text (default on, the user can switch it off):** captions in chunks of 1-3 words (white, thick dark outline, no box, key words bigger, inside the safe zone around y 1250), a big year/place card when the story names one ("PARIS 1925"), a name badge the first time each character is named ("VICTOR LUSTIG · CON MAN"), big numbers when the narrator says one ("7,000 TONS"), and a route ticket for travel ("PARIS → VIENNA"). Generate them from the word timings with `templates/scripts/overlays.py`. Skip a caption chunk when a badge or card already shows the same words.
9. **Hook in the picture too:** the first frame must show the paradox, not just say it. The Eiffel short opens on a giant SOLD! tag hanging on the tower and ends on a FOR SALE tag (callback).
10. **Sound effects stay under the voice.** Measure each SFX (max momentary loudness) and set it about 12 dB below the voice's loudest moments. ElevenLabs effects come out at wildly different levels (from -50 to -3 LUFS), never use one fixed gain.

## Framing rules (learned the hard way)
- **The vertical frame is narrow.** Visible half-width at distance d = tan(fov/2) × 0.5625 × d. At fov 50 and 6 m that is only ±1.6 m. Two characters in one shot must stand within about 1.2 m of each other, or the camera must back off. Check every two-shot with this formula before snapshotting.
- **Clear the line of sight.** Lamps, trees and railings placed for the wide shots end up inside close-ups. After the first snapshots, remove or move every prop that blocks a face. A railing or post in the foreground is good only when it covers less than a fifth of the frame.
- **Tracking shots follow the subject, not a guess.** For a moving train or car, compute the camera from the subject's position every frame.
- **Lens blur needs a focus point in every shot.** A shot without one must focus on the look-at point, or the whole frame goes soft.
- **Ink after the grade.** Mix the ink lines in after colour grading, about 4 px at 1080 wide, near-black. Mixed in before the grade they come out thin and grey.
- **Keep faces inside the safe zone:** x 160–920, y 250–1480 at 1080x1920.

## Step 6: Look check before rendering anything long
1. `npx hyperframes snapshot` at 6-10 key moments and LOOK at every PNG. Common first-version bugs: camera inside a wall, prop in front of a face, characters floating, everything too dark or too pastel.
2. Put our frame next to a reference frame (one image, side by side) and list the differences with numbers: outline coverage, saturation, darkest value, head-to-body ratio, blur strength, camera move length.
3. If the user says "it looks cheap" or the gap is big: split the work by topic (colour, ink, light, textures, characters, depth, camera). If you use several agents, give each its own copy of the project and its own files. Split the files, not just the jobs. Merge file by file at the end.
4. Repeat until the side-by-side looks like the same channel.

## Step 7: Sound and render
1. Music: calm, bouncy, under the voice (about 8 dB below speech). Sound effects on impacts, steps, doors. Use the music/SFX tools the user has, or simple synthesized sounds.
2. Draft render first: `npx hyperframes render --quality draft --output draft.mp4`, check duration and a few frames.
3. Final: `npx hyperframes render --quality delivery --output final.mp4`, mux the audio with ffmpeg.
4. Hand the user the file and one line: what to post it as (title idea + first comment).

## Rules
- Beginner first: one question at a time, plain words, no jargon without a 5-word explanation.
- Save progress after every step in `NOTES.md` so a new chat can continue.
- Never use the reference channel's name, clips, characters or script in the output.
