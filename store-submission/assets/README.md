# Marketplace image assets

These are the source and upload-ready image assets used for the live Microsoft Marketplace listing `WA200011925`.

## Store logos

- `contract-definitions-logo-300-transparent.png` — 300 × 300 PNG with transparent background.
- `contract-definitions-logo-300-paper.png` — 300 × 300 PNG on the product site's paper background.

Both use the same document-and-bookmark artwork as the add-in manifest icons. Choose the variant that displays most clearly in the live Partner Center preview.

## Store screenshots

The source screenshots are 1280 × 720 PNG files cropped from the real Microsoft Word demo screenshots captured on 28 August 2026. Partner Center currently requires 1366 × 768 PNG files, so upload-ready versions are stored in `upload/` and have been visually checked after scaling. The source screenshots are:

- `/Users/lukasgutwinski/Desktop/Screenshot 2026-08-28 at 16.44.58.png`
- `/Users/lukasgutwinski/Desktop/Screenshot 2026-08-28 at 16.45.10.png`
- `/Users/lukasgutwinski/Desktop/Screenshot 2026-08-28 at 16.45.58.png`

1. `01-searchable-definition-index.png`
   - Caption: Turn a long contract's defined terms into a searchable index without leaving Word.
2. `02-definition-detail.png`
   - Caption: Search for a defined term, read its meaning, and see whether it is used elsewhere.
3. `03-occurrence-navigation.png`
   - Caption: Navigate occurrences and add temporary inline annotations—without uploading the document.

Upload these files to Partner Center:

1. `upload/01-searchable-definition-index-1366x768.png`
2. `upload/02-definition-detail-1366x768.png`
3. `upload/03-occurrence-navigation-1366x768.png`

The unrelated Word ribbon area was cropped from the store candidates. The document and Contract Definitions task-pane content were not altered. The source document is fictional, is visibly marked as a demo, and contains no personal or confidential information.

The animated demo in `docs/assets/contract-definition-companion-demo.gif` is suitable for the product website or repository, but it is not a Marketplace screenshot upload. Partner Center uses static PNG screenshots; an optional listing video must be linked from YouTube or Vimeo and needs a separate 1280 × 720 PNG thumbnail.

Before a future update, confirm that each image still matches the submitted build and that the caption accurately describes the visible state.
