# London & York Countdown

A daily countdown calendar for the Coen family trip to London and York, Aug 17-26, 2026.

## Page Overview

Single-page HTML application styled as a vintage travel almanac/newspaper. Counts down 98 days from May 10 to departure on Aug 16, 2026, with an additional 10 trip-day tiles.

## Design

- **Theme**: Vintage newspaper/almanac aesthetic using Playfair Display, Lora, and Special Elite fonts
- **Color palette**: Paper tones (`#f0e6cf`), navy (`#15233f`), brass (`#b8893a`), oxblood (`#7c2c1f`), moss (`#4a5d3a`)
- **Layout**: Masthead header, hero countdown number, calendar grid of tiles grouped by month, trip-day tiles at the bottom
- **Responsive**: Adjusts grid and tile sizes at 600px breakpoint

## Features

### Tile System
- **98 countdown tiles** (May 10 - Aug 16) plus **10 trip-day tiles** (Aug 17-26)
- Tiles unlock one per day based on the current date
- States: locked (future), unopened (today/past), today (glowing animation), opened (stamped)
- Milestone tiles get special navy/brass styling

### Content Types
Each tile contains one of four content types:
1. **Milestone** - Trip progress markers (days 98, 92, 50, 30, 0)
2. **Prep** - Actionable tasks with checkboxes (booking tickets, packing, passport checks)
3. **Puzzle** - Interactive games:
   - Multiple choice trivia
   - Anagram unscrambling
   - Matching pairs
4. **Fact** - Cultural/historical information about London, York, and trip destinations

### British Slang Wordle
- Standalone game section below the trip calendar, always available
- Wordle-style gameplay: guess a British slang word in 6 tries
- Word length varies (4-9 letters) based on the slang term
- Deterministic daily word (seeded by date), plus "Next Word" for extra games
- On-screen keyboard with color-coded letter tracking (correct/present/absent)
- Physical keyboard support (letters, Enter, Backspace) when modal is closed
- Shows word definition after game ends (win or lose)
- Tracks stats: played, won, current streak
- 60+ British slang words with definitions
- Persists game state and stats in localStorage

### Persistence
- Uses `localStorage` (with fallback to `window.storage` for Claude artifacts)
- Tracks: opened tiles, completed prep tasks, solved puzzles
- Export progress as JSON, reset all progress

### Modal System
- Opens on tile click with animated overlay
- Shows content type, date, and interactive elements
- Locked tiles show days-until-unlock message
- Trip-day tiles show full day itinerary

## Content Map (Key Days)

| Days Out | Type | Topic |
|----------|------|-------|
| 98 | Milestone | Welcome / introduction |
| 97 | Prep | UK ETA application |
| 94 | Prep | BBC Proms booking prep |
| 92 | Milestone | Proms booking opens |
| 88 | Prep | Apple Pay Express Transit |
| 83 | Prep | Westminster Abbey booking |
| 80 | Prep | Tower of London booking |
| 70 | Prep | Churchill War Rooms |
| 67 | Prep | York Minster tickets |
| 60 | Prep | Restaurant shortlist |
| 57 | Prep | Passport expiration check |
| 54 | Prep | TSA PreCheck verification |
| 50 | Milestone | Halfway checkpoint |
| 47 | Prep | Last-night dinner booking |
| 41 | Prep | Chargers and adapters |
| 38 | Prep | Offline maps download |
| 35 | Prep | Book London dinners |
| 30 | Milestone | One month out |
| 29 | Prep | Start pack list |
| 19 | Prep | Verify seat assignments |
| 16 | Prep | Confirm Whitby tour |
| 13 | Prep | Save all tickets to phones |
| 10 | Prep | Final passport check |
| 7 | Prep | Charge everything |
| 4 | Prep | Refill prescriptions |
| 2 | Prep | Pack day |
| 1 | Prep | Final checks |
| 0 | Milestone | Departure day |

Days without explicit content get a rotating default fact (queueing, black cabs, Routemaster, pubs, police).

Puzzle topics rotate through: London landmarks, British vs American vocabulary (4 rounds), Tube lines, composers, trip itinerary knowledge, time zones, currency.

## Trip Itinerary (Trip-Day Tiles)

| Day | Date | Plan |
|-----|------|------|
| 1 | Aug 17 | Arrival, Abbey Road, Regent's Park |
| 2 | Aug 18 | Westminster Abbey, Churchill War Rooms |
| 3 | Aug 19 | British Museum, Soho |
| 4 | Aug 20 | South Ken museums, music |
| 5 | Aug 21 | LNER to York, city walls |
| 6 | Aug 22 | York Minster, Shambles |
| 7 | Aug 23 | Whitby & North York Moors tour |
| 8 | Aug 24 | LNER back to London, BBC Proms |
| 9 | Aug 25 | Tower of London, Borough Market, last dinner |
| 10 | Aug 26 | Departure home |

## Security Concerns

**This file contains sensitive personal information that should not be public.** See below for items that need to be redacted or the file needs access control:

- Airline confirmation number
- Train booking references
- Hotel confirmation numbers
- Heathrow Express ticket references
- Tour operator booking references
- Family members' full names
- Home city/state
- Exact travel dates (reveals when home is unoccupied)
- Seat assignments
- Pickup location (what3words)

**Recommended actions:**
1. Add `personal/` to `.gitignore` to prevent public hosting, OR
2. Replace all confirmation numbers with placeholders (e.g., `[CONF_NUMBER]`), OR
3. Move the page behind authentication

## Future Iteration Ideas

- [ ] Address security concerns above
- [ ] Add trip-day content beyond the basic itinerary summary
- [ ] Weather widget integration for London/York forecast as trip approaches
- [ ] Photo upload capability for trip-day tiles (post-trip memories)
- [ ] Progress bar or completion percentage
- [ ] Shareable family link with synced progress across devices
- [ ] Print-friendly packing list export
- [ ] Dark mode toggle
- [ ] Notification/reminder integration
- [ ] Post-trip mode: flip tiles into a travel journal
