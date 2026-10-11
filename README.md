# Nishant Rai — personal research website

A responsive Jekyll website with editable YAML content, local fonts, and a small progressive-enhancement script. No browser framework or analytics are required.

## Run locally

```bash
bash scripts/setup.sh
bash scripts/serve.sh
```

Open [the local preview](http://127.0.0.1:8767/). Jekyll watches content and styles; refresh the browser after edits. Restart the server after changing `_config.yml`. Use `PORT=8768 bash scripts/serve.sh` for another port.

On Apple Silicon, setup installs a pinned Ruby runtime and gems inside the checkout. Other platforms need Ruby 3.4 or newer. Initial setup needs network access; later builds use the installed dependencies.

`bash scripts/build.sh` creates static output in `_site/`. The production URL is `https://nishantrai18.github.io` with an empty `baseurl`. The build and preview scripts do not commit, push, or publish anything themselves.

## Edit content

| File | Content |
| --- | --- |
| `_data/profile.yml` | Biography, opening statement, portrait, and social links |
| `_data/affiliations.yml` | Organization marks and destinations |
| `_data/work.yml` | Recent work, grouped by organization |
| `_data/background.yml` | Education, recognition, teaching, talks, and service |
| `_data/publications.yml` | Papers, figures, links, and BibTeX |
| `_data/author_names.yml` | Display abbreviations keyed by full author name |
| `_includes/sections/`, `index.html` | Page sections and order |
| `_includes/work-item.html`, `_includes/publication.html` | Reusable work and publication markup |
| `_includes/service.html` | Talk and academic-service rows |
| `assets/css/site.css`, `assets/js/site.js` | Styling, filters, and citation interaction |

Each work item needs a unique lowercase slug `id`, short `title`, full `official_title`, `description`, primary `url`, local `image`, and `image_alt`. Optional `links` preserve related destinations as metadata. Use `image_fit: contain` to retain edge lettering and `image_theme: dark` for a dark frame; research diagrams always use contain. Years and organizations remain in data but are omitted from captions. Counts and filters follow the data automatically.

Education entries use affiliation IDs to share institution marks. Store `gpa` as a string to preserve its grading scale. Recognition rows accept `title`, `icon`, and optional `context`, `url`, or `links`. Service rows use `role`, `description`, and an optional `url`. Preserve precise role names and the distinction between main-conference reviewing and conference workshops.

Set a paper’s `selected` field to `true` for the initial collection. Preserve author order, full names, equal-contribution markers, years, and venues in the data; abbreviated names and hidden year/venue labels affect presentation only. Corporate reports can use `contributors` with a public `contributor_source`. Paper links use `pdf` when provided, otherwise `paper`; `project`, `code`, and `bibtex` are optional.

## Design and interaction

The page uses white, charcoal, cobalt, and restrained garnet accents. Inter supplies the main typography; Source Serif 4 supplies the italic opening statement. Shared spacing, colors, and responsive rules live in `assets/css/site.css`.

Recent work contains 13 tiles: eight OpenAI, three Waymo, and two Research. Tiles use rounded images, titles, and brief descriptions. Rows balance the visible collection: 13 items use 4 + 4 + 5, eight use 4 + 4, and four fill one row. The maximum is six per desktop row, reducing on narrower screens. Publications initially show four selected papers, with six in the full collection.

Filters preserve query state on reload and browser Back/Forward:

- `/?work=waymo#work` selects Waymo; other values are `openai`, `research`, and `all`.
- `/?papers=all#research` shows all publications.
- `/?work=openai&papers=all` combines both filters.

Without JavaScript, all work and papers remain visible and the native talks/service disclosure works. The citation dialog supports keyboard navigation, Escape, clipboard copying, and manual-copy recovery. Reduced motion and print layouts are supported.

## Validate changes

```bash
bash scripts/check.sh
bash scripts/test.sh
```

`check.sh` validates content, local assets, links, citations, accessibility references, and output exclusions. It builds root and subpath variants in temporary directories without replacing the running preview. It does not check remote URL availability.

`scripts/legacy-links.json` records hashes for preserved historical files and exact preexisting broken links. Those exceptions apply only while both the source and built file match the recorded hash; new pages and links receive the full checks. Deliberate edits to archived content require reviewing the corresponding manifest entry.

`test.sh` builds `_site/` and runs interaction tests using Node.js 20 or newer. On first use it installs the pinned Happy DOM dependency via pnpm. Tests cover filters, URL/history state, keyboard focus, citations, optional UI, and the unenhanced page. Also inspect desktop and phone layouts in a browser, operate the filters, and open/copy/close a citation.

## Publishing and future updates

The public repository is [nishantrai18/nishantrai18.github.io](https://github.com/nishantrai18/nishantrai18.github.io). The GitHub Actions workflow at `.github/workflows/pages.yml` validates pull requests and deploys pushes to `master` through GitHub Pages. GitHub Pages must use **GitHub Actions** as its deployment source.

For an update, begin with a clean working tree and synchronize before editing:

```bash
git switch master
git pull --ff-only
```

Run setup on a new checkout or after dependency changes, then start the local preview. Edit the relevant files, run both validation commands above, and check the result in the browser. Review and stage only the intended files; for example, a biography change:

```bash
git status --short
git diff
git add _data/profile.yml
git diff --cached
git commit -m "Update biography"
git push origin master
```

Use a branch and pull request when you want review before publication. A local build or a passing pull-request check does not publish the site; merging into `master` triggers deployment. After pushing, confirm the workflow succeeds in the repository’s **Actions** tab and inspect [the public website](https://nishantrai18.github.io/).

Legacy resources, project pages, CSS, fonts, and other existing public files are retained unchanged so older links keep working. The previous homepage remains available in Git history.

## Sources and assets

Work descriptions characterize the linked projects without implying sole ownership. Academic service retains the distinction between conference and workshop roles; publication metadata preserves accurate citations.

Work thumbnails use official launch artwork, source-linked Waymo images, and original research figures. Generated cobalt illustrations remain optional alternate assets. See [third-party notices](THIRD_PARTY_NOTICES.md) for public sources and licenses.

Private design and provenance notes stay local and are excluded from Git and generated website output. Tests, authoring tools, and local dependencies are also excluded from the generated site.
