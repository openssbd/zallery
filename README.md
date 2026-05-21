# zallery — OME-Zarr Image Gallery

A configurable, React-based web gallery for browsing OME-Zarr bioimage datasets driven by a CSV metadata file.  
Built to serve the [SSBD database](https://ssbd.riken.jp/) but designed to be reused with any OME-Zarr collection.

**Live:** https://openssbd.github.io/zallery/  
**Repository:** https://github.com/openssbd/zallery

## Features

- Browse **studies** and their **datasets** with thumbnail previews
- Full-text search across study and dataset metadata
- Filter by **Dimensions** (2D / 3D / +C / +T), **Organism**, **Imaging Method**, **License** — AND-combined
- In-browser **2D and 3D viewer** powered by [Viv](https://github.com/hms-dbmi/viv)
- One-click links to external viewers: [Vizarr](https://hms-dbmi.github.io/vizarr/), [Neuroglancer](https://neuroglancer-demo.appspot.com/), [OME-NGFF Validator](https://ome.github.io/ome-ngff-validator/), [Vol-E](https://vole.allencell.org/)
- Copy Zarr URL to clipboard
- Shareable URLs — search queries, filters, and page number are reflected in the URL
- Pagination

## Repository Structure

```
├── gallery/          # React web application
│   ├── public/       # Static assets (CSV, viewer icons)
│   └── src/
│       ├── config.ts # ← Edit this to customise the gallery
│       ├── data.ts   # CSV parsing and filter logic
│       ├── components/
│       └── pages/
├── scripts/          # Data preparation utilities
│   ├── fetch_dims.py       # Adds a Dimensions column to a CSV
│   └── diagnose_failed.py  # Diagnoses Zarr metadata fetch failures
└── data/             # Working CSV files (SSBD-specific)
```

## Quick Start

### Prerequisites

- Node.js ≥ 18 and npm ≥ 9
- A CSV file describing your OME-Zarr datasets (see [CSV Format](#csv-format) below)

### Install and Run

```bash
cd gallery
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## Configuration

All site-level settings are in **`gallery/src/config.ts`**:

```typescript
export const config = {
  // Path to the CSV file, relative to gallery/public/ or a full S3/HTTPS URL
  csvPath: '/your-data.csv',

  // Browser tab title
  siteTitle: 'My OME-Zarr Gallery',

  // H1 heading displayed in the page header
  siteHeading: 'My OME-Zarr Gallery',

  // Description shown below the heading
  siteSubtitle: 'Browse OME-Zarr bioimage datasets.',

  // Optional link appended to the subtitle — set to null to hide
  subtitleLink: {
    text: 'Browse via MyTool',
    url: 'https://example.com/my-tool',
  } as { text: string; url: string } | null,
}
```

Place the CSV in `gallery/public/` and set `csvPath` to `'/your-data.csv'`, or provide a full HTTPS/S3 URL (CORS must be enabled on the bucket).

## CSV Format

The CSV must include a header row. The gallery recognises the following column names (multiple names are accepted for the same field):

| Field | Required | Accepted column names |
|---|:---:|---|
| Study ID | ✓ | `SSBD:database ID`, `Study ID`, `Project ID` |
| Study Name | ✓ | `Project Name`, `Study Name` |
| Dataset | ✓ | `Dataset` |
| File Path | ✓ | `File Path` |
| Title | | `Title` |
| Organism / Species | | `Organism`, `Species` |
| Contact | | `Contact` |
| Organization | | `Organization` |
| Imaging Method | | `Biological Imaging Method` |
| Paper Information | | `Paper Information` |
| Paper DOI | | `Paper DOI` |
| License | ✓ | `Dataset License`, `License` |
| Dimensions | | `Dimensions` |

**File Path** must be the root URL of an OME-Zarr v0.4 group (e.g. `https://example.s3.amazonaws.com/data.zarr/0`).

**License** is required — its filter is always displayed in the UI.

**Dimensions**, **Organism**, and **Imaging Method** are optional. Their filter dropdowns appear only when at least one dataset in the CSV contains a value for that column. Use `scripts/fetch_dims.py` to generate the Dimensions column automatically. The expected format is `X x Y x Z x C x T` (e.g. `512 x 512 x 30 x 3 x 1`).

**Imaging Method** supports slash-separated values (e.g. `LSCM/TIRF`); each term becomes a separate filter option.

## Adding a Dimensions Column (optional)

`scripts/fetch_dims.py` reads an existing CSV and queries the Zarr metadata for every `File Path` to extract shape information, then writes a new CSV with a `Dimensions` column added.

```bash
# Edit INPUT / OUTPUT paths at the top of the script if needed, then:
pip install requests   # only if urllib is not sufficient; the script uses stdlib only
python scripts/fetch_dims.py
```

The script uses 30 parallel workers and handles transient network errors with a retry pass.

## Build and Deploy

```bash
cd gallery
npm run build
```

The production bundle is written to `gallery/dist/`. Deploy its contents to any static host:

- **GitHub Pages** — commit `dist/` or use a GitHub Actions workflow
- **Amazon S3** — upload `dist/` to a bucket configured for static website hosting
- **Netlify / Vercel** — point the publish directory to `gallery/dist/`

## Dependencies

| Package | Version | Purpose |
|---|---|---|
| [React](https://react.dev/) | 18 | UI framework |
| [TypeScript](https://www.typescriptlang.org/) | 5 | Type safety |
| [Vite](https://vitejs.dev/) | 5 | Build tool and dev server |
| [React Router](https://reactrouter.com/) | 6 | Client-side routing |
| [PapaParse](https://www.papaparse.com/) | 5 | CSV parsing |
| [ome-zarr.js](https://github.com/manzt/ome-zarr.js) | 0.0.x | Zarr thumbnail rendering |
| [@hms-dbmi/viv](https://github.com/hms-dbmi/viv) | 0.20.x | 2D / 3D OME-Zarr viewer |
| [deck.gl](https://deck.gl/) | 9.1.x | GPU-accelerated rendering (used by Viv) |
| [luma.gl](https://luma.gl/) | 9.1.x | WebGL abstraction (used by Viv) |

> **Note:** deck.gl and luma.gl require deduplication aliases in `vite.config.ts` to avoid bundling multiple copies. These are already configured.

## History

| Date | Milestone |
|---|---|
| 2026-05-01 | Initial development at the **OME Hackathon**, part of [OME Community Meeting 2026](https://www.openmicroscopy.org/events/ome-community-meeting-2026/) |
| 2026-05-03 | Filter system (Dims / Organism / Imaging Method / License), general CSV support, URL state sync |

## Acknowledgements

- **[Will Moore](https://github.com/will-moore)** — author of [ome-zarr.js](https://github.com/will-moore/ome-zarr.js), which powers the thumbnail rendering in this gallery.
- **[BioFile Finder](https://github.com/AllenInstitute/biofile-finder)** (Allen Institute) — an inspiration for the dataset browsing and filtering experience.
- **[zarrcade](https://github.com/JaneliaSciComp/zarrcade)** (Janelia Research Campus) — an inspiration for the idea of building a lightweight, CSV-driven OME-Zarr gallery.

## License

MIT
