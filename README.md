# Books Page - BookBeat Reading List

A polished web page displaying your audiobook listening history from BookBeat.

## Folder Contents

```
books/
├── index.html      # Main page
├── style.css       # Styling (dark theme)
├── script.js       # Data loading & display logic
├── BookBeat.json   # YOUR DATA (add this)
└── README.md       # This file
```

---

## Setup Instructions

### 1. Add Your BookBeat Data

Place your `BookBeat.json` export file in this folder. The JSON should contain:

```json
{
  "myfinishedbooks": [...],
  "mysavedbooks": [...],
  "myreadbooks": [...]
}
```

### 2. Test Locally

Open `index.html` in a browser. Due to CORS, you'll need a local server:

```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx serve .

# Using PHP
php -S localhost:8000
```

Then visit `http://localhost:8000`

### 3. Deploy to Cloudflare Pages

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → Pages
2. Click **Create a project** → **Direct Upload**
3. Name your project (or select existing site)
4. **Drag and drop the entire `books/` folder**
5. Click **Deploy**

For adding to an existing site (rasmushyllengren.com):
- Upload the `books` folder as a subfolder
- It will be available at `rasmushyllengren.com/books`

---

## Landing Page Card Snippet

Add this to your landing page to link to the Books section.

### HTML

```html
<a href="/books" class="card books">
  <div class="card-border"></div>
  <div class="card-content">
    <div class="card-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
        <path d="M8 7h6"/>
        <path d="M8 11h8"/>
      </svg>
    </div>
    <h2>Books</h2>
    <p>Audiobooks I've listened to on BookBeat</p>
    <div class="card-arrow">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M5 12h14M12 5l7 7-7 7"/>
      </svg>
    </div>
  </div>
</a>
```

### CSS

Add these styles to match your existing cards:

```css
/* Books card - Warm amber/gold theme */
.card.books .card-border {
  background: linear-gradient(135deg, #D4A574, #C9A962, #E8C87A);
}

.card.books .card-icon {
  background: linear-gradient(135deg, #D4A574, #C9A962);
  color: white;
}

.card.books .card-icon svg {
  width: 28px;
  height: 28px;
}
```

### Alternative Color Schemes

**Option A: Warm Amber (Recommended)**
```css
background: linear-gradient(135deg, #D4A574, #C9A962, #E8C87A);
```

**Option B: Deep Burgundy**
```css
background: linear-gradient(135deg, #8B4A5E, #A65D6E, #C97B8B);
```

**Option C: Forest Green**
```css
background: linear-gradient(135deg, #5D7A5D, #6B8E6B, #7FA37F);
```

### Alternative Icon (Emoji)

If you prefer a simpler approach:

```html
<div class="card-icon">📚</div>
```

With CSS:
```css
.card.books .card-icon {
  font-size: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

---

## Updating Your Data

When you get new data from BookBeat:

1. **Export from BookBeat** (Settings → Export Data or GDPR request)
2. **Replace** `BookBeat.json` with the new file
3. **Re-upload** to Cloudflare Pages:
   - Go to your Cloudflare Pages project
   - Click "Create new deployment"
   - Upload the updated `books/` folder

The page automatically reads the JSON on load, so updates are instant after deployment.

---

## Customization

### Theme Toggle (Optional)

To add a light/dark theme toggle, add this button to the HTML:

```html
<button class="theme-toggle" onclick="toggleTheme()">
  <span class="theme-icon">☀️</span>
</button>
```

### Change Cover Size

In `script.js`, modify the `coverSize` in CONFIG:
- `'S'` - Small (thumbnail)
- `'M'` - Medium (default, good balance)
- `'L'` - Large (higher quality, slower)

### Add Author Names

If your JSON includes author data, modify the `renderBookCard` function in `script.js`.

---

## Technical Notes

- **Cover images** are fetched from Open Library Covers API using ISBN
- **Fallback placeholder** shows for books without covers
- **Responsive** grid adjusts from 3 columns (mobile) to many (desktop)
- **No dependencies** - pure HTML, CSS, JavaScript
- **Dark theme** by default for comfortable reading

---

## Troubleshooting

**"Could not load book data"**
- Ensure `BookBeat.json` is in the same folder as `index.html`
- Check browser console for specific errors
- Verify JSON is valid (no trailing commas, proper quotes)

**No cover images showing**
- Open Library may not have covers for all ISBNs
- AudioBook editions sometimes have different ISBNs
- The placeholder will show for missing covers

**Dates not parsing**
- Ensure dates are ISO 8601 format
- Check that `finishedDate` or `date` fields exist in your JSON

---

---

## Working on this remotely

The setup this supports: Claude runs in a cloud environment, driven from a
phone. That environment can be deleted at any moment — and when it is, the
session transcript and anything unsaved inside it are gone for good. The pieces
below exist so that never costs any work: everything lands in git as it happens,
and the result is readable from a phone without a terminal.

| File | What it does |
|---|---|
| `tools/save.sh` | Commits, writes a log entry, and pushes — in one step. The push is what makes work survive. |
| `SESSION-LOG.md` | Running record of every save, newest first. Renders fine on github.com from a phone. |
| `status.html` | That log plus recent commits, styled to match the site. |
| `.claude/settings.json` | Optional `Stop` hook running `save.sh --auto` each time Claude finishes a turn. |

### Saving by hand

```bash
tools/save.sh                     # message generated from what changed
tools/save.sh "rework the grid"   # your own message
```

A clean tree is a no-op. If the push fails, the commit is still made locally and
re-running the script later pushes it — the script never fails the caller.

### Checking in from the phone

GitHub Pages serves this repo directly, and redeploys within a minute of every
push to `main`:

- **The site** — <https://rashyl6.github.io/books/> — the real page, live
- **The status page** — <https://rashyl6.github.io/books/status.html> — what changed and when

Cloudflare Pages at `rasmushyllengren.com/books` stays the production deploy
(see *Deploy to Cloudflare Pages* above). GitHub Pages is the preview you check
from your phone before promoting anything.

### Saving automatically

To have every Claude turn end in a commit and a push without asking, create
`.claude/settings.json`:

```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "bash \"$CLAUDE_PROJECT_DIR/tools/save.sh\" --auto",
            "timeout": 90
          }
        ]
      }
    ]
  }
}
```

Turns that changed nothing produce no commit. To stop it again, delete the file.
`tools/save.sh` keeps working by hand either way.

*Created for rasmushyllengren.com/books*
