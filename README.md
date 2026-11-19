# MRI Physics Teaching · Quarto preview

Open a terminal in this checkout and run `quarto preview`. Use
`quarto render` to build the static website in `_site/`.

- Edit a lesson in its `teaching-*.qmd` file. The topics index pulls its title,
  description and category from the top of the file. Add another file using the
  same naming pattern to include it in the catalogue.
- Put new lesson media in `images/`. Prefer Quarto Markdown image syntax for new
  figures. Add new raw HTML image references to the resources list in
  `_quarto.yml` so the image is copied to the published site.
- Edit practical briefs in `labs/`. The K-space and contrast
  simulators in `lab-apps/` are snapshots of the existing browser labs. The
  quantitative MRI brief links to its existing student-access site.
- The Quarto render list includes the teaching hub, lessons and lab briefs.
  The original site is preserved on the `legacy-site` branch.
