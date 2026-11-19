# Teaching materials @mriphysics

The [teaching site](https://mriphysics.github.io/) is built with Quarto and
hosted on GitHub Pages. The `master` branch contains the editable source.
Quarto combines that source with the site settings and stylesheet to generate
a static website in `_site/`. Visitors only need a browser.

## Edit the site

| What to edit | Source |
| --- | --- |
| Homepage, buttons, attribution and contact note | `index.qmd` |
| Teaching catalogue introduction | `teaching.qmd` |
| Individual lessons | `teaching-*.qmd` |
| Practical catalogue and briefs | `labs/index.qmd` and the other `.qmd` files in `labs/` |
| Site title, navigation, and render settings | `_quarto.yml` |
| Colours, typography and spacing | `teaching-site.css` |
| Lesson figures and animations | `images/` |

The topic catalogue reads the title, description, category and sort order from
the YAML at the top of each lesson. To add a lesson, copy an existing
`teaching-*.qmd` file, give it a new name with the same prefix, and update
those fields. Keep existing lesson filenames if their public URLs are already
in use. Use Markdown image links for new figures. If you use raw HTML for
an image, add its path to `project.resources` in `_quarto.yml`.

K-space and MRI contrast use bundled snapshots in `lab-apps/`. To update
a simulator, copy its updated static build into the corresponding folder.
The quantitative MRI brief links to its existing student-access site.

## Preview on your Mac

Install the [Quarto CLI](https://quarto.org/docs/get-started/) and open a
terminal in this repository. Run:

```sh
quarto preview
```

Save edits to see them in the browser. Press **Ctrl+C** in Terminal to stop
the preview. To check the entire site before publishing, run:

```sh
quarto render
```

Quarto regenerates `_site/`. Edit and commit the source files.

## Publish changes

GitHub Actions runs `quarto render` on pushes to `master`. The workflow
installs the Quarto version specified in
[`publish-quarto.yml`](.github/workflows/publish-quarto.yml), uploads `_site/`,
and deploys it to GitHub Pages.

1. Preview your edits locally, then commit the changed source files and push
   to `master`. Small edits can also be committed through GitHub’s web editor.
2. Check **Publish Quarto site** in the [Actions tab](https://github.com/mriphysics/mriphysics.github.io/actions).
3. Once deployment succeeds, check the changed page on the [live site](https://mriphysics.github.io/).

The repository’s **Settings → Pages → Source** must be set to **GitHub Actions**.
If a build fails, open its log in the Actions tab and check which step failed.
Run `quarto render` locally to diagnose rendering errors. If the local
preview looks unstyled, stop it, run a fresh render, then restart the preview.

## Find the previous site

The original HTML and Markdown site is preserved on the
[`legacy-site` branch](https://github.com/mriphysics/mriphysics.github.io/tree/legacy-site).
