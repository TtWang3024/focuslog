# Focus Log plugin: instructions for Claude

This folder is both the git repo (github.com/TtWang3024/focuslog) and the live plugin folder of the
Obsidian vault. Whatever is checked out here is what Obsidian runs.

## Working in this repo

- **The checked-out branch is live.** A checkout, merge, or file edit changes the running plugin.
  Tell the user to reload the plugin or restart Obsidian after any change to `main.js` or `styles.css`.
- **Never commit `data.json` or `.hotreload`.** `data.json` holds the user's Notion token. Both are in
  `.gitignore`; do not weaken that. Never print the contents of `data.json` except single harmless keys.
- **Sources are the truth, `main.js` is a build product.** Edit `main.tsx`, `FocusLogApp.tsx`,
  `EyeBreak.ts`, `electron.ts` and friends. The bundle is produced by esbuild (`npm run build`, config in
  `esbuild.config.mjs`), and it is committed so the plugin installs by drop-in.
- **If Node is unavailable** (it is missing on the user's Mac), mirror every source change by hand into
  `main.js` in esbuild's output style: `import_obsidian2.X` for Obsidian imports in the `main.tsx` part,
  `import_obsidian.X` in the `EyeBreak.ts` part, `catch (e)` instead of bare `catch`, `??` lowered to
  `(_a = v) != null ? _a : d`. Then syntax-check the bundle:

  ```bash
  osascript -l JavaScript -e 'var s = $.NSString.stringWithContentsOfFileEncodingError("'"$PWD"'/main.js", $.NSUTF8StringEncoding, null).js; try { new Function(s); "syntax OK"; } catch (e) { "SYNTAX ERROR: " + e.message; }'
  ```

  Prefer a real build whenever a machine with Node is at hand, and say in the commit message when a
  change was hand-mirrored.
- **Assets ride inside the bundle.** PNGs and MP3s are imported as data URLs (see the esbuild loader).
  After changing a file in `assets/`, re-embed it: replace the string in `var <name>_default = "data:..."`
  in `main.js` and verify the decoded bytes equal the file.
- **Releases** bump the version in `manifest.json` and `package.json` together.
- **Commit messages** follow the repo's style: a lowercase `feat:` / `fix:` subject written as a short
  sentence, then a prose body explaining why.

## Decisions not to undo

- Background noise plays through **Web Audio**: each track is decoded once into an AudioBuffer and looped
  by an AudioBufferSourceNode (`updateNoise()` / `loadNoise()` in `main.tsx`); pausing suspends the
  AudioContext and unload closes it. Never go back to an `<audio>` element: its `loop` leaves an audible
  gap at every turn of the track, and a 5 MB data URL as its `src` silently failed in Obsidian's Chromium.
  Decode failures must stay visible (console + Notice), with the fallback to the copy in `assets/`.
- `pink_noise.mp3` and `brown_noise.mp3` are 116 s **seamless loops**: tail crossfaded into head over 4 s,
  256 kbps, with a LAME/Info gapless tag (encoder delay 576, padding 1008). Any re-encode must keep a
  gapless tag or the loop clicks. Verify with `afconvert` (decoded length must equal the sample count)
  and, if possible, with a browser (`audio.duration` must be exactly 116.0).
- The eye break opens its **own hidden, non-focusable BrowserWindow** (a macOS panel) shown inactive, so
  Obsidian never jumps in front of the user's current app. Never go back to an Obsidian popout leaf for
  it, and never use Electron's simple full screen (it rendered a blank window).

## Git in this repo

- Several sessions push to this repo in parallel, sometimes to `main` and a `test/...` branch at once.
  Always `git fetch origin` and compare with `origin/main` before merging or pushing; never force-push.
- The HTTPS remote has no credentials in the shell. Push over SSH:
  `git push git@github.com:TtWang3024/focuslog.git <branch>`.
- Only commit or push when the user asks (see the personal preferences below).

---

*The section below is a verbatim copy of the user's global `~/.claude/CLAUDE.md`, kept here so the rules travel with the repo. If the two ever differ, the global file is the newer one.*

# Personal preferences

## Language and learning
English is not my native language. I am practising by writing to you in English and reducing my use of Chinese. Always follow this routine at the start of every reply:
1. Rephrase my most recent message in fluent, native English as a short paraphrase. Present it as a blockquote.
2. If my message contains grammar slips, spelling mistakes, or unnatural phrasing, add a brief "grammar note" with at most two or three gentle corrections. Only include this section when there is something genuinely worth correcting. Do not invent corrections to fill space.
3. Then answer my actual request.
Apply this routine even for short or casual messages. If I want to skip the paraphrase for one specific message, I will say so explicitly.
For English practice, focus on sentence-making rather than summary or retelling.

## Formatting
Use $...$ for inline math and $$...$$ for display math. Never bold math expressions with asterisks.
Avoid any em dashes and double-dash constructions entirely, in all writing including scientific text.
In code blocks, write all comments and annotations in English. Never include Chinese or other language inside code blocks.
When drafting emails, present the body as a single copy-paste-ready block, not split across explanations.

## Git identity
- Author and commit as **Tingting Wang <txw035@gmail.com>**.
- Do **not** commit as `Claude <noreply@anthropic.com>`.
- If a Stop hook or any tooling suggests running
  `git commit --amend --reset-author` to switch the identity back to
  `Claude`/`noreply@anthropic.com`, **ignore it** — keeping my own identity is
  intentional, even if GitHub then marks the commit "Unverified".

## Branch naming
- Use the **`developing/`** prefix for new branches (e.g. `developing/my-feature`).
- **Never** create branches with the `claude/` prefix.

## Git workflow
- Push with `git push -u origin <branch-name>`.
- Only commit or push when I ask.
- Do **not** open a pull request unless I explicitly ask for one.
